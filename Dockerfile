FROM alpine:latest AS appBuild

LABEL maintainer="Peponi <pep0ni@pm.com>" \
      description="will run a nodejs based web service"

ARG REPO_URL="https://github.com/myliang/x-spreadsheet.git"
ARG VERSION="master"
ARG PROJECT_NAME=nodejs_app
ARG PKG_MANAGER="yarn"
ARG ONLY_DEPENDECIES=""
ARG BEFORE_BUILD="ls"
ARG BUILD_COMMAND="yarn build"
ARG AFTER_BUILD="ls -la"
ARG ADD_BUILD_PKGS=""
ENV PROJECT_NAME=$PROJECT_NAME \
    ONLY_DEPENDECIES=$ONLY_DEPENDECIES \
    PKG_MANAGER=$PKG_MANAGER \
    BEFORE_BUILD=$BEFORE_BUILD \
    AFTER_BUILD=$AFTER_BUILD \
    BUILD_COMMAND=$BUILD_COMMAND \
    ADD_BUILD_PKGS=$ADD_BUILD_PKGS

RUN set -e;\
  apk add  \
    bash \
    git \
    $PKG_MANAGER $ADD_BUILD_PKGS; \
  echo "node version: " && node --version; \
  echo $PKG_MANAGER" version: " && $PKG_MANAGER --version; \
  mkdir -p /home/root/$PROJECT_NAME; \
  cd /home/root/$PROJECT_NAME; \
  git clone -b $VERSION --single-branch $REPO_URL .; \
  echo "$PKG_MANAGER install $ONLY_DEPENDECIES --no-optional"; \
  $PKG_MANAGER install $ONLY_DEPENDECIES --no-optional; \
  $BEFORE_BUILD; \
  $BUILD_COMMAND; \
  $AFTER_BUILD

FROM alpine:latest

ARG USER=appuser
ARG PORT=3000
ARG PROJECT_NAME=nodejs_app
ARG DIST_FOLDER_PATH=dist
ARG INDEX_FILE_NOT_IN_DIST=""
ENV USER=$USER \
    PORT=$PORT \
    PROJECT_NAME=$PROJECT_NAME \
    DIST_FOLDER_PATH=$DIST_FOLDER_PATH \
    INDEX_FILE_NOT_IN_DIST=$INDEX_FILE_NOT_IN_DIST

RUN set -e; \
  apk update; \
  apk upgrade; \
  apk add --no-cache --virtual \
    bash \
    python \
    curl; \
  addgroup -g 12345 $USER;  \
  adduser -u 12345 -G $USER -s /bin/bash -D $USER

WORKDIR /home/$USER/$PROJECT_NAME
COPY --from=appBuild /home/root/$PROJECT_NAME/index.html .
COPY --from=appBuild /home/root/$PROJECT_NAME/$DIST_FOLDER_PATH .

RUN if [ "$INDEX_FILE_NOT_IN_DIST" != "" ]; \
  then \
  ls -la; \
  mkdir $DIST_FOLDER_PATH; \
  mv `ls -1 ./ | grep -v index.html` $DIST_FOLDER_PATH/; \
  mv $DIST_FOLDER_PATH/server .; \
  ls -la; \
  fi; \
  chown -R $USER:$USER *; \
  chown -R $USER:$USER .

USER $USER
EXPOSE $PORT

CMD python -m SimpleHTTPServer $PORT

HEALTHCHECK CMD curl --fail http://127.0.0.1:$PORT/ || exit 1

### Install ###
#
# Build:
# 
# > docker build -t x-spreadsheet:v1.0.25-alpine --build-arg REPO_URL="https://github.com/myliang/x-spreadsheet.git" --build-arg VERSION="v1.0.25" .
# 
# Run:
# 
# > docker run --rm -p 3000:3000 x-spreadsheet:v1.0.25-alpine
# 
###############
