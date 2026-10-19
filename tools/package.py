"""Deterministic pack archive; no caches, source maps or development dependencies."""
from pathlib import Path
import zipfile,hashlib,json
root=Path(__file__).resolve().parents[1]
out=root/'dist';out.mkdir(exist_ok=True)
path=out/'Spider-Man-Definitive-Experience-1.0.0.mcaddon'
with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for folder in ['behavior_pack','resource_pack']:
  for p in sorted((root/folder).rglob('*')):
   if p.is_file():
    name=p.relative_to(root).as_posix(); info=zipfile.ZipInfo(name,date_time=(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,p.read_bytes())
hash=hashlib.sha256(path.read_bytes()).hexdigest()
(out/(path.name+'.sha256')).write_text(f'{hash}  {path.name}\n')
print(f'{path.relative_to(root)} ({path.stat().st_size} bytes)\nSHA256 {hash}')
