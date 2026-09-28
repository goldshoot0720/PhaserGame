#!/usr/bin/env python3
"""Build a signed, offline APK with the installed Android SDK (no Gradle downloads)."""
import argparse, json, os, secrets, shutil, subprocess, zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--sdk', default=os.environ.get('ANDROID_HOME', '/opt/homebrew/share/android-commandlinetools'))
parser.add_argument('--java', default=os.environ.get('JAVA_HOME', '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home'))
args = parser.parse_args()
sdk, java = Path(args.sdk), Path(args.java)
build = root / '.cache/android-build'
assets = build / 'assets/site'
classes = build / 'classes'
dex = build / 'dex'
for folder in (assets, classes, dex, root / 'release'):
    folder.mkdir(parents=True, exist_ok=True)
shutil.copytree(root / '.cache/release-site', assets, dirs_exist_ok=True)
tools = sdk / 'build-tools/35.0.1'
android = sdk / 'platforms/android-35/android.jar'
env = dict(os.environ, JAVA_HOME=str(java), PATH=str(java / 'bin') + os.pathsep + os.environ['PATH'])
def run(*command):
    subprocess.run([str(x) for x in command], check=True, cwd=root, env=env)

run(java / 'bin/javac', '--release', '8', '-classpath', android, '-d', classes,
    root / 'packaging/android/src/com/goldshoot/phaser/MainActivity.java')
run(tools / 'd8', '--lib', android, '--min-api', '26', '--output', dex, *classes.rglob('*.class'))
unsigned = build / 'unsigned.apk'
resources = build / 'resources.zip'
run(tools / 'aapt2', 'compile', '--dir', root / 'packaging/android/res', '-o', resources)
run(tools / 'aapt2', 'link', '-I', android, resources, '--manifest', root / 'packaging/android/AndroidManifest.xml',
    '-A', build / 'assets', '-o', unsigned)
with zipfile.ZipFile(unsigned, 'a', compression=zipfile.ZIP_DEFLATED) as archive:
    for file in dex.glob('*.dex'):
        archive.write(file, file.name)
aligned = build / 'aligned.apk'
run(tools / 'zipalign', '-f', '-p', '4', unsigned, aligned)

# Keep the installation identity outside the repository for future upgrades.
signing = Path.home() / '.local/share/moe-game-collection/signing'
signing.mkdir(parents=True, exist_ok=True, mode=0o700)
credentials = signing / 'credentials.json'
keystore = signing / 'release.jks'
if not credentials.exists():
    descriptor = os.open(credentials, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        json.dump({'password': secrets.token_hex(24)}, stream)
env['MOE_SIGNING_PASSWORD'] = json.loads(credentials.read_text())['password']
if not keystore.exists():
    run(java / 'bin/keytool', '-genkeypair', '-keystore', keystore, '-storepass:env', 'MOE_SIGNING_PASSWORD',
        '-keypass:env', 'MOE_SIGNING_PASSWORD', '-alias', 'moe-release', '-keyalg', 'RSA', '-keysize', '3072',
        '-validity', '10000', '-dname', 'CN=Moe Game Collection, OU=Games, O=goldshoot0720, C=TW')
    keystore.chmod(0o600)
output = root / 'release/MoeGameCollection-1.0.3-android.apk'
run(tools / 'apksigner', 'sign', '--ks', keystore, '--ks-key-alias', 'moe-release',
    '--ks-pass', 'env:MOE_SIGNING_PASSWORD', '--key-pass', 'env:MOE_SIGNING_PASSWORD', '--out', output, aligned)
run(tools / 'apksigner', 'verify', '--verbose', output)
run(tools / 'aapt2', 'dump', 'badging', output)
print(f'APK ready: {output}')
