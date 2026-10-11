import math, struct, wave, sys
dur=float(sys.argv[1]); out=sys.argv[2]; sr=44100; n=int(sr*dur)
f=lambda m:440*2**((m-69)/12)
chords=[(48,[60,64,67]),(43,[59,62,67]),(45,[60,64,69]),(41,[60,65,69])]
seg=3.75; buf=[0.0]*n
def add(start,length,freq,amp,attack=0.01,decay=3.0,harm=(1,0.35,0.12)):
    s=int(start*sr); L=int(length*sr)
    for i in range(L):
        j=s+i
        if j>=n: break
        t=i/sr; env=min(1,t/attack)*math.exp(-decay*t)
        buf[j]+=amp*env*sum(a*math.sin(2*math.pi*freq*(k+1)*t) for k,a in enumerate(harm))
for si in range(int(math.ceil(dur/seg))):
    bass,notes=chords[si%4]; t0=si*seg
    add(t0,seg+0.4,f(bass-12),0.16,attack=0.08,decay=0.5,harm=(1,0.2))
    for m in notes: add(t0,seg+0.5,f(m-12),0.045,attack=0.25,decay=0.35,harm=(1,0.15))
    k=0; t=t0
    while t<t0+seg-0.01:
        add(t,1.2,f(notes[[0,1,2,1][k%4]]+12),0.09,attack=0.004,decay=3.2); t+=0.5; k+=1
for i in range(n):
    t=i/sr; buf[i]*=min(1,t/0.8)*min(1,(dur-t)/1.8)
peak=max(abs(x) for x in buf)
with wave.open(out,'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b''.join(struct.pack('<h',int(x/peak*0.55*32767)) for x in buf))
