#!/bin/bash
set -eu
scriptdir=$(cd $(dirname $0) && pwd)

mkdir -p $scriptdir/../.timers
cd $scriptdir/../.timers


if [[ "${1:-}" == "start" ]]; then
    timername="$2"
    ts=$(node -p 'Date.now()')
    echo $ts > "$timername.start"
    exit 0
fi

if [[ "${1:-}" == "end" ]]; then
    timername="$2"
    ts=$(node -p 'Date.now()')
    start=$(cat "$timername.start")
    delta=$(($ts - $start))
    if [[ -f "$timername.total" ]]; then
        total=$(cat "$timername.total")
    else
        total=0
    fi
    total=$(($total + $delta))
    echo $total > "$timername.total"
    exit 0
fi

if [[ "${1:-}" == "report" ]]; then
    for totalfile in *.total; do
        [[ -f "$totalfile" ]] || break;
        # millis
        minutes=$(($(cat "$totalfile") / 60000))
        echo -e "$totalfile\t\t${minutes}m"
    done
    exit 0
fi

if [[ "${1:-}" == "clear" ]]; then
    rm -rf *
    exit 0
fi

echo "Usage: timer.sh start|end <TIMER>" >&2
echo "Usage: timer.sh report" >&2
echo "Usage: timer.sh clear" >&2
exit 1
