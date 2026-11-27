# Voiceover finishing: pace, a fuller "broadcast" tone, 0.3 s lead-in, 15.0 s,
# -16 LUFS. Writes a 48 kHz stereo wav that prepare-ad.py and the lip-sync use.
#   bash scripts/voice/finish-voice.sh in.wav out.wav [tempo, e.g. 0.92]
set -e
IN="$1"; OUT="$2"; TEMPO="${3:-1.0}"
ffmpeg -v error -y -i "$IN" -af "\
silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,\
atempo=$TEMPO,\
highpass=f=70,\
equalizer=f=170:t=q:w=0.9:g=2.5,\
equalizer=f=3200:t=q:w=1.2:g=1.5,\
equalizer=f=7500:t=q:w=1.5:g=-1.5,\
acompressor=threshold=-20dB:ratio=3:attack=6:release=90:makeup=2,\
adelay=300:all=1,\
loudnorm=I=-16:TP=-2:LRA=7,aresample=48000,apad=whole_dur=15.0,atrim=0:15.0" -ar 48000 -ac 2 "$OUT"
