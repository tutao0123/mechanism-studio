"""Measure retained source mesh tooth phases. No geometry or source bytes change."""
from pathlib import Path
import importlib.util, json, hashlib, sys
import numpy as np
from scipy.signal import find_peaks
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('source_sections', HERE.parents[1] / 'tour/research-v2/gear-sections.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
rows = []
for name, count in [('sun-gear', 96), ('planet-4', 24)]:
    triangles = source.triangles(name)
    center = [source.parts[name]['worldCenter'][0], source.parts[name]['worldCenter'][2]]
    samples = []
    for y in [.00025, .001, .003, .004, .006, .008, .010, .011, .012, .014, .016, .018, .019, .021, .02175]:
        segments = source.section(triangles, y)
        angles, radii = source.profile(segments, center, 'max', 0, 16384)
        amplitude = radii.max()-radii.min()
        peaks = find_peaks(np.tile(radii, 3), prominence=amplitude*.2, distance=16)[0]
        peaks = peaks[(peaks >= len(radii)) & (peaks < 2*len(radii))]-len(radii)
        assert len(peaks) == count, (name, y, len(peaks))
        harmonic = np.mean((radii-radii.mean())*np.exp(-1j*count*angles))
        phase = -np.angle(harmonic)/count
        errors = np.angle(np.exp(1j*count*(angles[peaks]-phase)))/count
        samples.append({'y': y, 'phase': float(phase), 'peakCount': len(peaks),
                        'maxPeakErrorRadians': float(abs(errors).max()), 'harmonicAmplitude': float(abs(harmonic)),
                        'radialRangeMetres': [float(radii.min()), float(radii.max())]})
    unwrapped = np.unwrap(np.array([x['phase'] for x in samples])*count)/count
    for s, p in zip(samples, unwrapped): s['phase'] = float(p)
    rows.append({'role': 'sun' if count == 96 else 'planet', 'name': name, 'id': source.parts[name]['id'],
                 'count': count, 'center': source.parts[name]['worldCenter'], 'samples': samples})
out = {'revision': 'wolf-source-tooth-phase-4', 'sourceSHA256': source.index['sourceSHA256'],
       'geometryRevision': source.index['geometryRevision'], 'assetSHA256': hashlib.sha256(source.raw).hexdigest(),
       'method': '16384 radial rays per triangle-plane section, complete-turn peak count, tooth-count Fourier phase, period-unwrapped along axial Y. Original source triangles and world transforms retained.',
       'parts': rows}
(HERE / 'tooth-phase-sections.json').write_text(json.dumps(out, indent=2)+'\n')
for r in rows:
    print(r['name'], [(s['y'], round(s['phase']*180/np.pi, 6), s['radialRangeMetres']) for s in r['samples']])
