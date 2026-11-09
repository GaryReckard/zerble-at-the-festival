#!/usr/bin/env python3
"""Map Chrome CPU samples through the exact captured build's V3 source maps."""
import argparse,collections,json
from pathlib import Path
from urllib.parse import urlparse

alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
def vlq(segment):
    values=[];number=shift=0
    for char in segment:
        value=alphabet.index(char);number+=(value&31)<<shift
        if value&32:shift+=5
        else:
            values.append(-(number>>1) if number&1 else number>>1);number=shift=0
    if shift:raise ValueError('Incomplete VLQ')
    return values

p=argparse.ArgumentParser(description=__doc__);p.add_argument('profile',type=Path);p.add_argument('snapshot',type=Path);a=p.parse_args()
profile=json.loads(a.profile.read_text());maps={}
def location(frame):
    name=Path(urlparse(frame['url']).path).name
    file=a.snapshot/'dist/assets'/(name+'.map')
    if not file.exists():return frame['functionName'] or '(anonymous)',name,frame['lineNumber']+1
    if name not in maps:
        raw=json.loads(file.read_text());source=line=column=label=0;lines=[]
        for encoded in raw['mappings'].split(';'):
            generated=0;segments=[]
            for token in encoded.split(','):
                if not token:continue
                values=vlq(token);generated+=values[0]
                if len(values)>=4:
                    source+=values[1];line+=values[2];column+=values[3]
                    if len(values)>=5:label+=values[4]
                    segments.append((generated,source,line,column,label if len(values)>=5 else None))
            lines.append(segments)
        maps[name]=(raw,lines)
    raw,lines=maps[name]
    candidates=lines[frame['lineNumber']] if 0<=frame['lineNumber']<len(lines) else []
    candidates=[s for s in candidates if s[0]<=frame['columnNumber']]
    if not candidates:return frame['functionName'] or '(anonymous)',name,frame['lineNumber']+1
    _,source,line,column,label=candidates[-1]
    original=raw['sources'][source].removeprefix('../../')
    function=raw['names'][label] if label is not None else frame['functionName'] or '(anonymous)'
    return function,original,line+1

nodes={n['id']:n for n in profile['nodes']};parents={child:n['id'] for n in nodes.values() for child in n.get('children',[])}
locations={id:location(n['callFrame']) for id,n in nodes.items()}
self_cost=collections.Counter();inclusive=collections.Counter();reachability=collections.Counter()
for sample,delta in zip(profile['samples'],profile['timeDeltas']):
    self_cost[locations[sample]]+=delta
    seen=set();node=sample
    while node in nodes:
        key=locations[node]
        if key not in seen:
            inclusive[key]+=delta;seen.add(key)
            if key[0] in ('canReachPlace','canReachCampSlot') and node in parents:
                caller=locations[parents[node]];reachability[(key[0]+' <- '+caller[0],caller[1],caller[2])]+=delta
        if node not in parents:break
        node=parents[node]
def rows(counter):return [dict(function=k[0],file=k[1],line=k[2],ms=round(v/1000,3)) for k,v in counter.most_common()]
print(json.dumps(dict(scope='Sampling attribution only; CPU samples and elapsed main-loop timers are different measurements.',
    totalSampledMs=sum(profile['timeDeltas'])/1000,self=rows(self_cost),inclusive=rows(inclusive),reachabilityCallers=rows(reachability)),indent=2))
