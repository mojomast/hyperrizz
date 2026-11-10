"""Hermes registrations stay fast, offline and profile-neutral."""
from pathlib import Path
import inspect
import json

from .hyperrizz_plugin.service import dispatch, bind_tool_result


def schema(name, description, ops, extra):
    return {"name": name, "description": description, "parameters": {
        "type": "object", "properties": {"op": {"type": "string", "enum": ops},
        "project": {"type": "string"}, **extra}, "required": ["op"], "additionalProperties": False}}


SCHEMAS = [
    schema("hyperrizz_project", "Create and edit film source. Read before writing; writes require the file SHA. Creation starts a live-preview build.",
           ["list", "create", "status", "files", "read", "write", "restore", "reconcile"], {
               "title": {"type": "string"}, "template": {"type": "string", "enum": ["starter", "broadcast"]},
               "path": {"type": "string"}, "content": {"type": "string"}, "expected_sha": {"type": "string"},
               "revision": {"type": "integer"}}),
    schema("hyperrizz_review", "Bind a project to this chat's pane, read frame notes, resolve feedback, or open/checkpoint/close the full editor.",
           ["open", "notes", "note", "resolve", "editor", "checkpoint", "close_editor"], {
               "session_id": {"type": "string"}, "frame": {"type": "integer"}, "revision": {"type": "integer"},
               "text": {"type": "string"}, "note_id": {"type": "string"}}),
    schema("hyperrizz_produce", "Start build/check/render jobs; inspect progress or cancel. Render verifies candidates, including a non-blank opening frame, before publishing. Build after source edits.",
           ["build", "check", "render", "job", "cancel"], {"job": {"type": "string"}}),
]


def register(ctx):
    ctx.register_skill("production", Path(__file__).parent / "SKILL.md")
    ctx.register_hook("post_tool_call", bind_tool_result)
    for spec in SCHEMAS:
        def handler(args=None, _name=spec["name"], **kwargs):
            # Serialization is enforced on every success and failure path.
            return json.dumps(dispatch(_name, args or {}), ensure_ascii=False)
        options = dict(name=spec["name"], toolset="hyperrizz", schema=spec,
                       handler=handler, description=spec["description"], emoji="🎬")
        params = inspect.signature(ctx.register_tool).parameters
        if not any(p.kind == p.VAR_KEYWORD for p in params.values()):
            options = {k: v for k, v in options.items() if k in params}
        ctx.register_tool(**options)
