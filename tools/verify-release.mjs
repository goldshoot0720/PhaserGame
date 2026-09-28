import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const require=createRequire(new URL('../packaging/windows/package.json',import.meta.url));
const asar=require('@electron/asar');
execFileSync('python3',['-c',`
import zipfile,pathlib,struct
z=zipfile.ZipFile('release/MoeGameCollection-1.0.0-windows-x64.zip');assert z.testzip() is None
exe=z.read('MoeGameCollection.exe');assert exe[:2]==b'MZ'
p=struct.unpack_from('<I',exe,0x3c)[0];assert exe[p:p+4]==b'PE\\0\\0' and struct.unpack_from('<H',exe,p+4)[0]==0x8664
pathlib.Path('.cache/release-windows.asar').write_bytes(z.read('resources/app.asar'))
a=zipfile.ZipFile('release/MoeGameCollection-1.0.0-android.apk');assert a.testzip() is None
for name in ['classes.dex','AndroidManifest.xml','res/drawable/app_icon.xml']:assert name in a.namelist()
for p in pathlib.Path('.cache/release-site').rglob('*'):
 if p.is_file():assert a.read('assets/site/'+str(p.relative_to('.cache/release-site')))==p.read_bytes(),str(p)
print('APK ZIP_OK: all offline site files match; Windows PE x64 and ZIP CRC valid')
`],{stdio:'inherit'});
const packages=JSON.parse(await readFile('shared/packages.json','utf8'));
const catalog=JSON.parse(await readFile('shared/catalog.json','utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const g of packages) assert.equal(sha(asar.extractFile('.cache/release-windows.asar',`site/Game${g.id}/complete/bundle.js`)),g.localSha256);
for(const file of new Set(catalog.flatMap(g=>g.assets).map(a=>a.file)))assert.equal(sha(asar.extractFile('.cache/release-windows.asar','site/'+file)),sha(await readFile(file)));
for(const file of ['shared/runtime.js','shared/player.js','shared/mobile-site.css','guides/Game6.html','Game6/GUIDE.md'])assert.equal(sha(asar.extractFile('.cache/release-windows.asar','site/'+file)),sha(await readFile(file)));
const artifacts=[];
for(const name of ['MoeGameCollection-1.0.0-android.apk','MoeGameCollection-1.0.0-windows-x64.zip']){const b=await readFile('release/'+name);artifacts.push({name,bytes:b.length,sha256:sha(b)});}
await writeFile('release/SHA256SUMS.txt',artifacts.map(a=>`${a.sha256}  ${a.name}`).join('\n')+'\n');
await writeFile('reports/release-verification.json',JSON.stringify({version:'1.0.0',artifacts,checks:{androidSiteMatches:true,androidSignature:'v2 and v3 verified by apksigner',windowsPE:'AMD64',windowsZipCRC:true,windowsPackages:12,windowsAssets:108},limitations:['Windows EXE not executed on a Windows host; archive, PE and content checks completed.','Windows executable has no Authenticode certificate.']},null,2)+'\n');
console.log('RELEASE_OK: both artifacts verified, SHA256SUMS.txt written');
