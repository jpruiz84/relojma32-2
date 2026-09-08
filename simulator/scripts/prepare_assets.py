"""Rebuild browser assets and provenance from the original design; no network required."""
import json, re, shutil, hashlib
from pathlib import Path
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'simulator/public/assets'
OUT.mkdir(parents=True, exist_ok=True)

def copy(source, dest):
    shutil.copyfile(ROOT / source, OUT / dest)

copy('Circuitos/Version 2/modelo.3DS', 'board.3ds')
copy('Manual/fuentes/LCD Display Grid.ttf', 'lcd.ttf')
copy('Manual/manual.pdf', 'manual.pdf')
copy('Circuitos/Version 2/placa real.PDF', 'pcb.pdf')
copy('Manual/figuras/logo galeras digital.svg', 'logo.svg')
copy('Otros/etiqueta.svg', 'label.svg')
for name in ['frente1','inferior1','superior1','teclado1','conpotencia']:
    copy(f'Manual/figuras/{name}.svg', f'{name}.svg')
(OUT / 'firmware.asm.txt').write_text((ROOT / 'relojma.asm').read_text(encoding='latin1'))
(OUT / 'schematic.txt').write_text((ROOT / 'Circuitos/Version 2/placa real.SDF').read_text(encoding='latin1'))
photos=[]
for folder in ['Pagina', 'Manual/figuras', 'Folleto/partes', 'Folleto/Fotos']:
    for p in sorted((ROOT/folder).iterdir()):
        if p.suffix.lower() not in ['.png','.jpg','.jpeg']: continue
        image=ImageOps.exif_transpose(Image.open(p)).convert('RGB')
        image.thumbnail((1400,1400))
        filename=f'photo-{len(photos):02d}.webp'
        image.save(OUT/filename,'WEBP',quality=90)
        photos.append({'source':str(p.relative_to(ROOT)), 'url':f'assets/{filename}', 'width':image.width, 'height':image.height})

# Exact component values and net connectivity from the exported ISIS schematic.
sdf=(ROOT/'Circuitos/Version 2/placa real.SDF').read_text(encoding='latin1')
parttext=sdf.split('*PARTLIST,')[1].split('\n',1)[1].split('*NETLIST,')[0]
parts={}
for line in parttext.splitlines():
    if not line.strip():continue
    fields=line.split(','); ref, device, value=fields[:3]
    parts[ref]={'ref':ref,'device':device,'value':value,'package':re.search(r'PACKAGE=([^,\s]+)',line).group(1)}
edf=(ROOT/'Circuitos/Version 2/placa real.EDF').read_text()
for ref,x,y,angle in re.findall(r'\(place (\S+) ([\d.-]+) ([\d.-]+) front ([\d.-]+)\)',edf):
    if ref in parts:parts[ref].update(x=float(x),y=float(y),rotation=float(angle))
nettext=sdf.split('*NETLIST,')[1].split('\n',1)[1].split('*')[0]
nets=[]
for block in re.split(r'\n\s*\n',nettext.strip()):
    lines=block.strip().splitlines()
    if not lines:continue
    connections=[]
    for line in lines[1:]:
        f=line.split(',')
        if len(f)>=3 and f[0] in parts:connections.append({'ref':f[0],'pin':f[2]})
    nets.append({'name':lines[0].split(',')[0],'connections':connections})
# Preserve exact saved autorouter paths, useful for circuit inspection.
ses=(ROOT/'Circuitos/Version 2/placa real.ses').read_text()
traces=[]
for layer,width,coords in re.findall(r'\(path (\S+) (\d+)\s+([\d\s.-]+)\)',ses):
    v=[float(n)/100000 for n in coords.split()]
    traces.append({'layer':layer,'width':int(width)/100000,'points':[[v[i],v[i+1]] for i in range(0,len(v)-1,2)]})
presets=[]
for p in sorted(ROOT.glob('*.MCH')):
    b=[int(x,16) for x in p.read_text().split()]
    presets.append({'name':p.stem,'source':p.name,'bytes':b,'complete':len(b)==256})
manifest={'photos':photos,'components':list(parts.values()),'nets':nets,'traces':traces,'presets':presets,
 'enclosure':{'width':113.1,'height':154.8,'depth':99.6,'depthNote':'99.6 mm connector-panel dimension; enclosure depth and assembly offsets inferred from photographs.', 'source':'Caja/medidas.ods'},
 'board':{'width':95.25,'height':74.93,'source':'Circuitos/Version 2/modelo.3DS','sha256':hashlib.sha256((OUT/'board.3ds').read_bytes()).hexdigest()}}
(OUT/'design.json').write_text(json.dumps(manifest,indent=2))
print(f'Prepared {len(photos)} images, {len(parts)} components, {len(nets)} nets, {len(traces)} traces, {len(presets)} EEPROM captures.')
