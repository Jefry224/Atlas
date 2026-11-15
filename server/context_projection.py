"""Bounded factual provider context with independent decision-section coverage.

Paths and scientific values remain those of the caller (including the historical
telemetry alias). Coverage is transport metadata, never a scientific conclusion.
"""

from __future__ import annotations

import heapq
import itertools
import json
import math
from collections import Counter
from typing import Any

MAX_LEAVES = 400
MAX_LIST_ITEMS = 24
MAX_TEXT_CHARS = 2_048
MAX_VALUE_BYTES = 4_096
MAX_DEPTH = 14
MAX_OBJECT_FIELDS = 128
MAX_SECTION_NODES = 4_096
MAX_SERIALIZED_BYTES = 131_072
MAX_SECTION_BYTES = 20_000
MAX_COVERAGE_EXAMPLES = 12
MAX_OMITTED_PATHS = 4

# Reservations are independent; unused slots are shared only after every
# supplied section has received its reservation. Metadata uses ten slots.
SECTION_BUDGETS = {
    "identity": 45, "expedition": 95, "landing": 65, "audit": 60,
    "processes": 30, "environment": 20, "gaps": 15, "other": 5, "surface": 55,
}
IDENTITY = {
    "scenario", "site", "earth", "target", "dem", "mission", "session",
    "identity", "contextIdentity", "activeMission", "rover", "targetRover",
    "roverBody", "targetBody", "domain", "mode", "scope", "sessionId",
    "generatedAt", "capturedAtUTC", "cutoffUTC", "snapshotAtUTC", "similarity",
}
EXCLUDED = {
    "elevation", "elevations", "raster", "rasters", "mesh", "meshes",
    "pixels", "imageData", "path", "paths", "rawPath", "actualPath",
    "history", "rawHistory", "events", "roverHistory", "weatherHistory",
    "curve", "curves", "hourly", "series", "samples", "hours",
    "trajectory", "tracks", "log",
}
# Repeated flight profiles are represented by identity/source only. Actual
# run limits, plan constraints, outcomes and contact readings remain eligible.
PROFILE_FIELDS = {"id", "body", "label", "kind", "source", "sources", "version", "schema"}
PRIORITY = [
    "surfaceAssessment", "earthExpedition", "expedition", "activeRun", "analogyAudit", "processes",
    "scenario", "earth", "target", "landing", "telemetry", "forecast",
    "identity", "contextIdentity", "activeMission", "mission", "session",
    "rover", "targetRover", "roverBody", "targetBody", "scope", "mode",
    "hazards", "missingModules", "dataGaps", "destinationPreparation",
    "sessionId", "missionId", "scenarioId", "id", "domain", "body", "name",
    "status", "phase", "valid", "source", "sources", "dataset", "provenance",
    "fetchedAt", "fetchedAtUTC", "observedAt", "atUTC", "kind", "reason",
    "objective", "decision", "outcome", "limitations", "limitation", "gaps",
    "unavailableModules", "benchmark", "dem", "site", "preparation", "config",
    "payload", "route", "stops", "results", "observations", "inspections",
    "evidence", "counts", "matrix", "calibration", "gravity", "pressure",
    "thermal", "inputs", "best", "windows", "runs", "plans", "contact",
    "limits", "nativeResolutionMeters", "spacingMeters", "extentMeters",
    "gridSize", "center", "roles", "breakdown", "strength", "action",
]
_RANK = {key: i for i, key in enumerate(PRIORITY)}


def _order(key: str) -> tuple[int, str]:
    return _RANK.get(key, len(_RANK)), key


def _alias(path: str) -> str:
    return path.replace(".telemetry.values.", ".telemetry.")


def _valid_text(value: str) -> bool:
    try:
        value.encode("utf-8")
        return True
    except UnicodeEncodeError:
        return False


def _valid_key(key: str) -> bool:
    return len(key) <= 80 and _valid_text(key) and not any(c in key for c in ".[]\n\r=\t")


def _scalar(value: Any) -> bool:
    if isinstance(value, str):
        return len(value) <= MAX_TEXT_CHARS and _valid_text(value) and len(value.encode("utf-8")) <= MAX_VALUE_BYTES
    if isinstance(value, float):
        return math.isfinite(value)
    if isinstance(value, int):
        return value.bit_length() <= MAX_VALUE_BYTES
    return value is None


class _Section:
    def __init__(self) -> None:
        self.fields: list[tuple[str, Any]] = []
        self.reasons: Counter[str] = Counter()
        self.examples: list[dict[str, Any]] = []
        self.selected = 0
        self.bytes = 0
        self.budget_reason: str | None = None

    def omit(self, path: str, reason: str, **detail: Any) -> None:
        self.reasons[reason] += 1
        if len(self.examples) < MAX_COVERAGE_EXAMPLES:
            self.examples.append({"path": path, "reason": reason, **detail})

    def collect(self, node: Any, path: str, node_limit: int) -> list[tuple[str, Any]]:
        """Fairly interleave sibling branches; never scan excluded raw data."""
        ancestors: set[int] = set()
        inspected_nodes = 0

        def walk(value: Any, current: str, depth: int):
            nonlocal inspected_nodes
            inspected_nodes += 1
            if inspected_nodes > node_limit:
                self.omit(current, "node-budget; descendants not inspected")
                return
            if depth > MAX_DEPTH:
                self.omit(current, "depth; descendants not inspected")
                return
            if isinstance(value, (dict, list)):
                if id(value) in ancestors:
                    self.omit(current, "cycle")
                    return
                # Each child is fully collected before interleaving. Ancestors
                # track recursion, allowing repeated but non-cyclic objects.
                ancestors.add(id(value))
                children = []
                if isinstance(value, dict):
                    keys = heapq.nsmallest(MAX_OBJECT_FIELDS, (k for k in value if isinstance(k, str)), key=_order)
                    if len(value) > len(keys):
                        self.omit(current, "object-fields", totalFields=len(value), inspectedFields=len(keys))
                    if not value:
                        children = [[(current, {})]]
                    for key in keys:
                        if current == "analogyAudit" and key == "landing":
                            continue  # Independently reserved in the landing section.
                        child_path = f"{current}.{key}" if current else key
                        if not _valid_key(key):
                            self.omit(current, "unsafe-or-long-key")
                        elif key in EXCLUDED and isinstance(value[key], (dict, list)):
                            self.omit(child_path, "excluded-raw-or-redundant", totalItems=len(value[key]))
                        elif key in {"grid", "rover", "weather"} and isinstance(value[key], list):
                            self.omit(child_path, "excluded-raster-or-history", totalItems=len(value[key]))
                        elif current.split(".")[-2:-1] == ["profiles"] and key not in PROFILE_FIELDS:
                            self.omit(child_path, "redundant-profile-field")
                        else:
                            children.append(list(walk(value[key], child_path, depth + 1)))
                else:
                    total = len(value)
                    # Preserve legacy short scalar lists as a single value.
                    if total <= MAX_LIST_ITEMS and all(v is None or isinstance(v, (str, bool, int, float)) for v in value):
                        if all(_scalar(v) for v in value) and len(json.dumps(value, ensure_ascii=False).encode("utf-8")) <= MAX_VALUE_BYTES:
                            children = [[(current, value.copy())]]
                        else:
                            children = [list(walk(v, f"{current}[{i}]", depth + 1)) for i, v in enumerate(value)]
                    else:
                        # Process windows are already ranked by M3; preserve
                        # their original indices and never rank scientific data.
                        limit = 3 if any(k in current for k in ("Windows", "windows.")) else MAX_LIST_ITEMS
                        start = max(0, total - limit) if current.split(".")[-1] in {"inspections", "evidence"} else 0
                        if total > limit:
                            self.omit(current, "list-items", totalItems=total, inspectedItems=limit, omittedItems=total-limit, inspectedStartIndex=start)
                        children = [list(walk(value[i], f"{current}[{i}]", depth + 1)) for i in range(start, min(total, start + limit))]
                ancestors.remove(id(value))
                for row in itertools.zip_longest(*children):
                    for item in row:
                        if item is not None:
                            yield item
            elif isinstance(value, str) and len(value) > MAX_TEXT_CHARS:
                self.omit(current, "text-too-long", originalCharacters=len(value))
            elif isinstance(value, str) and not _valid_text(value):
                self.omit(current, "invalid-unicode")
            elif isinstance(value, str) and len(value.encode("utf-8")) > MAX_VALUE_BYTES:
                self.omit(current, "text-bytes", originalCharacters=len(value))
            elif isinstance(value, float) and not math.isfinite(value):
                self.omit(current, "non-finite-number")
            elif isinstance(value, int) and value.bit_length() > MAX_VALUE_BYTES:
                self.omit(current, "oversized-integer")
            elif value is None or isinstance(value, (str, int, float, bool)):
                yield current, value
            else:
                self.omit(current, "non-json-value")

        return list(walk(node, path, 0))


def project_context(context: Any) -> dict[str, Any]:
    sections = {name: _Section() for name in SECTION_BUDGETS}
    roots: dict[str, list[tuple[str, Any]]] = {name: [] for name in sections}

    def add(name: str, value: Any, path: str) -> None:
        roots[name].append((path, value))

    if isinstance(context, dict):
        keys = heapq.nsmallest(MAX_OBJECT_FIELDS, (k for k in context if isinstance(k, str)), key=_order)
        if len(context) > len(keys):
            sections["other"].omit("", "object-fields", totalFields=len(context), inspectedFields=len(keys))
        for key in keys:
            value = context[key]
            if not _valid_key(key):
                sections["other"].omit("", "unsafe-or-long-key")
            elif key == "contextProjection":
                sections["other"].omit(key, "reserved-transport-metadata")
            elif key in EXCLUDED and isinstance(value, (dict, list)):
                sections["other"].omit(key, "excluded-raw-or-redundant", totalItems=len(value))
            elif key in {"grid", "rover", "weather"} and isinstance(value, list):
                sections["other"].omit(key, "excluded-raster-or-history", totalItems=len(value))
            elif key in {"earthExpedition", "expedition", "activeRun"}:
                add("expedition", value, key)
            elif key == "surfaceAssessment":
                add("surface", value, key)
            elif key in {"landing", "preparation", "destinationPreparation"}:
                add("landing", value, key)
            elif key == "analogyAudit" and isinstance(value, dict):
                if "landing" in value:
                    add("landing", value["landing"], key + ".landing")
                add("audit", value, key)
            elif key in {"analogyAudit", "calibration"}:
                add("audit", value, key)
            elif key == "processes":
                add("processes", value, key)
            elif key in {"telemetry", "forecast", "weather", "environment"}:
                add("environment", value, key)
            elif key in {"hazards", "unavailableModules", "missingModules", "dataGaps", "limitations"}:
                add("gaps", value, key)
            else:
                add("identity" if key in IDENTITY else "other", value, key)
    else:
        add("other", context, "context")

    for name, values in roots.items():
        # A large Earth object cannot consume the scan allowance for target
        # identity, rover state or another root within the same section.
        node_limit = MAX_SECTION_NODES // max(1, len(values))
        branches = [sections[name].collect(value, path, node_limit) for path, value in values]
        seen: set[str] = set()
        for row in itertools.zip_longest(*branches):
            for item in row:
                if item is None:
                    continue
                path = _alias(item[0])
                if path in seen:
                    sections[name].omit(item[0], "alias-collision")
                else:
                    seen.add(path)
                    sections[name].fields.append(item)

    out: dict[str, Any] = {}
    # Leave room for bounded coverage metadata and one overall descriptor.
    data_limit = MAX_LEAVES - len(sections) - 1
    data_bytes = 0

    def take(name: str) -> bool:
        nonlocal data_bytes
        section = sections[name]
        if section.selected >= len(section.fields) or len(out) >= data_limit:
            return False
        path, value = section.fields[section.selected]
        path = _alias(path)
        size = len(json.dumps({path: value}, ensure_ascii=False).encode("utf-8"))
        if section.bytes + size > MAX_SECTION_BYTES:
            section.budget_reason = "section-bytes"
            return False
        if data_bytes + size > MAX_SERIALIZED_BYTES // 2:
            section.budget_reason = "global-bytes"
            return False
        section.selected += 1
        section.bytes += size
        data_bytes += size
        out[path] = value
        return True

    # Round-robin reservations also remain fair when every section is supplied.
    for slot in range(max(SECTION_BUDGETS.values())):
        for name, budget in SECTION_BUDGETS.items():
            if slot < budget:
                take(name)
    while len(out) < data_limit:
        if not any([take(name) for name in sections]):
            break

    for name, section in sections.items():
        omitted = len(section.fields) - section.selected
        out[f"contextProjection.sections.{name}"] = {
            "supplied": bool(roots[name]) or bool(section.reasons),
            "retainedFields": section.selected,
            "eligibleFields": len(section.fields),
            "omittedEligibleFields": omitted,
            "omittedFieldPaths": [_alias(path) for path, _ in section.fields[section.selected:section.selected + MAX_OMITTED_PATHS]],
            "omittedFieldPathsComplete": omitted <= MAX_OMITTED_PATHS,
            "budgetOmissionReason": section.budget_reason or ("field-limit" if omitted else None),
            "complete": omitted == 0 and not section.reasons,
            "omissionCounts": dict(sorted(section.reasons.items())),
            "examples": section.examples,
            "examplesComplete": sum(section.reasons.values()) <= MAX_COVERAGE_EXAMPLES,
        }
    out["contextProjection"] = {
        "version": "provider-context/1", "maxFields": MAX_LEAVES,
        "maxListItems": MAX_LIST_ITEMS, "maxTextCharacters": MAX_TEXT_CHARS,
        "maxValueBytes": MAX_VALUE_BYTES,
        "maxDepth": MAX_DEPTH, "maxSectionNodes": MAX_SECTION_NODES,
        "maxSerializedBytes": MAX_SERIALIZED_BYTES,
        "sectionReservations": dict(SECTION_BUDGETS),
        "coverageMeaning": "Counts describe inspected nodes and eligible fields only; uninspected descendants are not counted. Missing or omitted evidence is not a negative finding. List examples report inspected items, not guaranteed retained items; section field coverage includes later budget omissions.",
    }
    # Paths can be long even with a depth bound. Drop diagnostic path samples
    # (not facts or coverage counts) to enforce the wire-size ceiling.
    while len(json.dumps(out, ensure_ascii=False).encode("utf-8")) > MAX_SERIALIZED_BYTES:
        candidates = [(v, field) for k, v in out.items() if k.startswith("contextProjection.sections.")
                      for field in ("examples", "omittedFieldPaths") if v[field]]
        if not candidates:
            break
        largest, field = max(candidates, key=lambda item: len(json.dumps(item[0][item[1]], ensure_ascii=False)))
        largest[field].pop()
        largest[field + "Complete"] = False
    return out
