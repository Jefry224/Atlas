#!/usr/bin/env python3
"""Verify, acquire pinned official sources, or rebuild NASA visual assets offline.

Default is read-only verification with Python's standard library. Blender and Pillow
are preparation tools only; no browser/runtime dependency is installed by this script.
"""
import argparse
import hashlib
import json
import math
import struct
import subprocess
import tempfile
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'assets/data/nasa-assets.json'
CONVERTED = {'scarecrow', 'perseverance', 'lro', 'block-island', 'apollo-11'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def local(path):
    result = (ROOT / path).resolve()
    if not result.is_relative_to(ROOT) or Path(path).is_absolute():
        raise ValueError('Asset must be inside Atlas: ' + path)
    return result


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
        f.write(data)
        temporary = Path(f.name)
    temporary.chmod(0o644)
    temporary.replace(path)


def image_type(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    raise ValueError('Unexpected image header')


def inspect_glb(data):
    assert len(data) >= 28 and data[:4] == b'glTF', 'Not a GLB'
    assert struct.unpack_from('<II', data, 4) == (2, len(data)), 'GLB2 length/version mismatch'
    chunks = []
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from('<II', data, offset)
        assert size % 4 == 0 and offset + 8 + size <= len(data), 'Invalid chunk'
        chunks.append((kind, data[offset + 8:offset + 8 + size]))
        offset += 8 + size
    assert offset == len(data) and [x[0] for x in chunks] == [0x4E4F534A, 0x004E4942]
    gltf = json.loads(chunks[0][1])
    binary = chunks[1][1]
    assert gltf['asset']['version'] == '2.0'
    assert len(gltf['buffers']) == 1 and 'uri' not in gltf['buffers'][0]
    assert 0 <= len(binary) - gltf['buffers'][0]['byteLength'] <= 3
    assert not ({'KHR_draco_mesh_compression', 'EXT_meshopt_compression'} & set(gltf.get('extensionsUsed', []))), 'Requires external decoder'
    for view in gltf.get('bufferViews', []):
        assert view['buffer'] == 0
        assert view.get('byteOffset', 0) >= 0 and view['byteLength'] > 0
        assert view.get('byteOffset', 0) + view['byteLength'] <= gltf['buffers'][0]['byteLength']
    for image in gltf.get('images', []):
        assert 'uri' not in image and 'bufferView' in image, 'External texture'
        view = gltf['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        assert image_type(binary[start:start + view['byteLength']]) == image['mimeType']
    triangles = vertices = 0
    for mesh in gltf['meshes']:
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4, 'Expected triangles'
            position = gltf['accessors'][primitive['attributes']['POSITION']]
            assert position['type'] == 'VEC3' and position['count'] > 0
            assert all(math.isfinite(x) for x in position['min'] + position['max'])
            vertices += position['count']
            count = gltf['accessors'][primitive['indices']]['count'] if 'indices' in primitive else position['count']
            assert count % 3 == 0
            triangles += count // 3
    assert gltf.get('scenes') and gltf['scenes'][gltf.get('scene', 0)].get('nodes')
    return {'meshes': len(gltf['meshes']), 'vertices': vertices, 'triangles': triangles,
            'images': len(gltf.get('images', [])), 'extensions': gltf.get('extensionsUsed', []),
            'externalDependencies': 0}


def check_source(path, expected):
    data = path.read_bytes()
    assert digest(data) == expected, 'Source SHA256 mismatch: ' + str(path)
    if path.suffix == '.stl':
        assert len(data) >= 84 and len(data) == 84 + 50 * struct.unpack_from('<I', data, 80)[0], 'Malformed binary STL'
    elif path.suffix == '.zip':
        assert data[:2] == b'PK'
        with zipfile.ZipFile(path) as archive:
            assert archive.testzip() is None
            assert any(n.endswith('.blend') for n in archive.namelist())
    elif path.suffix == '.glb':
        assert data[:4] == b'glTF' and struct.unpack_from('<II', data, 4) == (2, len(data))
    return data


def download(url, path, expected):
    assert urllib.parse.urlsplit(url).hostname in {'assets.science.nasa.gov', 'svs.gsfc.nasa.gov', 'trek.nasa.gov'}
    with urllib.request.urlopen(url, timeout=120) as response:
        data = response.read()
        assert response.status == 200
    assert digest(data) == expected, 'Official source changed; review before replacing: ' + url
    atomic(path, data)


def verify(manifest):
    assert manifest['schema'] == 'NasaVisualAssets' and manifest['version'] == '1.0.0'
    required = {'id', 'label', 'body', 'role', 'localPath', 'format', 'sourceUrl', 'downloadUrl',
                'credit', 'bytes', 'sha256', 'licenseUrl', 'notes', 'available'}
    ids = set()
    for asset in manifest['assets']:
        assert required <= asset.keys() and asset['id'] not in ids
        ids.add(asset['id'])
        assert asset['available'] is True and asset['localPath'], 'Unavailable asset: ' + asset['id']
        data = local(asset['localPath']).read_bytes()
        assert len(data) == asset['bytes'] and digest(data) == asset['sha256'], 'Asset checksum mismatch: ' + asset['id']
        details = inspect_glb(data) if asset['format'] == 'glb' else {'mime': image_type(data)}
        if asset.get('projection', {}).get('capabilitiesPath'):
            projection = asset['projection']
            assert digest(local(projection['capabilitiesPath']).read_bytes()) == projection['capabilitiesSha256']
        if 'originalSha256' in asset:
            check_source(local(asset['originalPath']), asset['originalSha256'])
        print(asset['id'], asset['bytes'], asset['sha256'], json.dumps(details))
    assert {'scarecrow', 'perseverance', 'moon', 'mars', 'lro', 'block-island', 'apollo-11'} <= ids
    for tile in json.loads(local('assets/textures/nasa/originals/mars-color/tiles.json').read_text()):
        data = local(tile['path']).read_bytes()
        assert len(data) == tile['bytes'] and digest(data) == tile['sha256']
        assert image_type(data) == 'image/jpeg'
    print('OK: seven self-contained GLB2 models, textures and pinned source hashes.')


def rebuild(asset, blender, refresh):
    with tempfile.TemporaryDirectory(prefix='atlas-nasa-') as directory:
        work = Path(directory)
        if asset['id'] in CONVERTED:
            if not blender:
                raise ValueError('--blender /absolute/path/to/blender is required for conversion')
            source = local(asset['originalPath'])
            check_source(source, asset['originalSha256'])
            if asset['id'] == 'scarecrow':
                with zipfile.ZipFile(source) as archive:
                    name, = [n for n in archive.namelist() if n.endswith('.blend')]
                    source = work / 'scarecrow.blend'
                    source.write_bytes(archive.read(name))
            output = work / 'model.glb'
            report = work / 'conversion.json'
            subprocess.run([blender, '--background', '--factory-startup', '--python-exit-code', '1',
                            '--python', str(ROOT / 'scripts/prepare-nasa-assets-blender.py'), '--',
                            '--id', asset['id'], '--input', str(source), '--output', str(output),
                            '--report', str(report)], check=True)
            data = output.read_bytes()
            inspect_glb(data)
            metadata = json.loads(report.read_text())
        elif asset['id'] == 'mars-color':
            from PIL import Image
            tiles = json.loads(local(asset['originalPath']).read_text())
            image = Image.new('RGB', (2048, 1024))
            for tile in tiles:
                path = local(tile['path'])
                assert digest(path.read_bytes()) == tile['sha256']
                with Image.open(path) as part:
                    assert part.size == (256, 256)
                    image.paste(part, (tile['column'] * 256, tile['row'] * 256))
            output = work / 'mars-color.jpg'
            image.save(output, quality=95, subsampling=0, optimize=False)
            data = output.read_bytes()
            metadata = None
        else:
            return
        if not refresh:
            assert digest(data) == asset['sha256'], 'Rebuild differs from lock; inspect before --refresh-lock: ' + asset['id']
        atomic(local(asset['localPath']), data)
        asset.update(bytes=len(data), sha256=digest(data))
        if metadata:
            asset.update(transformations=metadata['transformations'], bounds=metadata['bounds'])
            details = inspect_glb(data)
            asset['geometry'] = {k: details[k] for k in ('meshes', 'vertices', 'triangles', 'images')}
            atomic(ROOT / 'assets/models/nasa' / (asset['id'] + '.conversion.json'),
                   (json.dumps(metadata, ensure_ascii=False, indent=2) + '\n').encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true', help='Read-only verification (also the default).')
    parser.add_argument('--download', action='store_true', help='Download only pinned official originals; requires network.')
    parser.add_argument('--rebuild', action='store_true', help='Rebuild conversions and stitched texture entirely offline.')
    parser.add_argument('--blender', help='Isolated Blender executable; tested with 4.5.9 LTS.')
    parser.add_argument('--id', action='append', help='Limit download/rebuild to selected IDs; verify still checks all.')
    parser.add_argument('--refresh-lock', action='store_true', help='Accept reviewed new exporter bytes and update manifest hashes.')
    args = parser.parse_args()
    assert not args.refresh_lock or args.rebuild, '--refresh-lock requires --rebuild'
    manifest = json.loads(MANIFEST.read_text())
    for asset in manifest['assets']:
        if args.id and asset['id'] not in args.id:
            continue
        if args.download:
            if asset['id'] == 'mars-color':
                for tile in json.loads(local(asset['originalPath']).read_text()):
                    download(tile['url'], local(tile['path']), tile['sha256'])
            else:
                path = asset.get('originalPath', asset['localPath'])
                expected = asset.get('originalSha256', asset['sha256'])
                download(asset['downloadUrl'], local(path), expected)
        if args.rebuild:
            rebuild(asset, args.blender, args.refresh_lock)
            if args.refresh_lock:
                atomic(MANIFEST, (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode())
    verify(manifest)


if __name__ == '__main__':
    main()
