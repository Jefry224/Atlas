"""Syntax/scope evidence, using the real tinycss2 parser (not a CSS engine).

From Atlas: PYTHONPATH=/tmp/atlas-preparation-css-check python3 \
  docs/evidencias/preparacion-diseno/validar-css.py
tinycss2 is installed outside this repository; no runtime dependency is added.
"""
import hashlib
import json
from pathlib import Path

import tinycss2

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
source = (ROOT / 'mission-preparation.css').read_text()
errors = []
counts = {'rules': 0, 'declarations': 0}


def validate(rules, keyframes=False):
    for rule in rules:
        if rule.type == 'error':
            errors.append({'line': rule.source_line, 'message': rule.message})
        elif rule.type == 'at-rule' and rule.content is not None:
            validate(tinycss2.parse_rule_list(rule.content, skip_comments=True,
                                            skip_whitespace=True),
                     rule.lower_at_keyword.endswith('keyframes'))
        elif rule.type == 'qualified-rule':
            counts['rules'] += 1
            selector = tinycss2.serialize(rule.prelude).strip()
            if not keyframes and not selector.startswith('.landing-preparation'):
                errors.append({'line': rule.source_line,
                               'message': 'Selector fuera de scope: ' + selector})
            for item in tinycss2.parse_declaration_list(
                    rule.content, skip_comments=True, skip_whitespace=True):
                if item.type == 'error':
                    errors.append({'line': item.source_line, 'message': item.message})
                elif item.type == 'declaration':
                    counts['declarations'] += 1
                    if item.important:
                        errors.append({'line': item.source_line,
                                       'message': 'Declaración important no permitida'})


validate(tinycss2.parse_stylesheet(source, skip_comments=True, skip_whitespace=True))
result = {
    'file': 'mission-preparation.css',
    'sha256': hashlib.sha256(source.encode()).hexdigest(),
    'parser': 'tinycss2 ' + tinycss2.__version__,
    'checks': counts,
    'errors': errors,
    'limitations': 'Analiza sintaxis y scope; propiedades y valores se comprueban '
                   'por separado con CSSOM del navegador real.',
}
(OUT / 'validacion-css.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False))
assert not errors
