"""Validate the skill package without installing render dependencies."""
import ast
import json
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
excluded = {'.git', 'node_modules', '__pycache__', '.pytest_cache', '.work', '.build', '.cache', 'out', 'previews'}
files = [p for p in root.rglob('*') if p.is_file() and not excluded.intersection(p.relative_to(root).parts)]
errors = []
for p in files:
    try:
        if p.suffix == '.md':
            text = p.read_text()
            targets = re.findall(r'\]\(([^)\s]+)', text) + re.findall(r'(?:src|href)="([^"]+)"', text)
            for target in targets:
                if target.startswith(('https://', 'http://', 'mailto:', '#')):
                    continue
                local = target.split('#', 1)[0]
                if local and not (p.parent / local).exists():
                    errors.append(f'{p.relative_to(root)}: broken link {target}')
        elif p.suffix == '.json':
            json.loads(p.read_text())
        elif p.suffix == '.py':
            ast.parse(p.read_text(), filename=str(p))
        elif p.suffix in {'.js', '.mjs'}:
            subprocess.run(['node', '--check', str(p)], check=True, capture_output=True, text=True)
        elif p.suffix == '.svg':
            ET.parse(p)
    except (ValueError, SyntaxError, ET.ParseError, subprocess.CalledProcessError) as e:
        errors.append(f'{p.relative_to(root)}: {e}')
skill = (root / 'SKILL.md').read_text()
if not re.search(r'^---\nname: Hyperrizz\ndescription: .+\n', skill):
    errors.append('Skill frontmatter must name and describe Hyperrizz')
starter = root / 'templates/starter'
package = json.loads((starter / 'package.json').read_text())
lock = json.loads((starter / 'package-lock.json').read_text())
if package['devDependencies'] != lock['packages']['']['devDependencies']:
    errors.append('Starter dependencies and lockfile disagree')
for name, version in package['devDependencies'].items():
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        errors.append(f'Unpinned starter dependency: {name}')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'PASS: {len(files)} package files; links, syntax, SVG, skill metadata and dependency pins checked.')
