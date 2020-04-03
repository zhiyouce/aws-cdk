#!/bin/bash
scripts/timer.sh clear
scripts/timer.sh start everything

scripts/timer.sh start yarn
yarn --version || npm -g install yarn
yarn install --frozen-lockfile
scripts/timer.sh end yarn

/bin/bash ./fetch-dotnet-snk.sh
/bin/bash ./scripts/align-version.sh
/bin/bash ./build.sh
"[ -f .BUILD_COMPLETED ] && /bin/bash ./pack.sh"

scripts/timer.sh end everything
scripts/timer.sh report
