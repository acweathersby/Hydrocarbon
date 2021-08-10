#! /bin/bash

source ./build/emsdk/emsdk_env.sh

TEMP_NAME=$1
OUT_NAME=$2

>&2 echo "TempName:"
>&2 echo $TEMP_NAME
>&2 echo "OutName:"
>&2 echo $OUT_NAME

>&2 echo "Working directory: $(pwd)"

emcc -Oz\
    -w\
    -DINIT_TABLE_EXTERNALLY\
    --no-entry\
    -s ASSERTIONS=0\
    -s MALLOC=none\
    -s TOTAL_STACK=512kb\
    -s INITIAL_MEMORY=768kb\
    -s ALLOW_MEMORY_GROWTH=1\
    -s STANDALONE_WASM=1\
    -s ERROR_ON_UNDEFINED_SYMBOLS=0\
    -s EXPORTED_FUNCTIONS='["_init_data","_get_next_command_block","_init_table","_get_fork_pointers","_recognize","_malloc","_free"]'\
    -o $OUT_NAME\
    -I./source/\
    ./source/hc_cpp/source/core_parser.cpp\
    $TEMP_NAME 

