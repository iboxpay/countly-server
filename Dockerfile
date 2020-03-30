FROM phusion/baseimage:0.11

CMD ["/sbin/my_init"]

## Setup Countly
ENV INSIDE_DOCKER 1
ENV INSIDE_DOCKER_NOMONGO 1
ENV DEBIAN_FRONTEND noninteractive

COPY / /opt/countly

RUN apt-get update && apt-get install -y sudo && rm -rf /var/lib/apt/lists/*
RUN rm /etc/dpkg/dpkg.cfg.d/excludes
RUN apt-get update && \
    dpkg -l | grep ^ii | cut -d' ' -f3 | xargs apt-get install -y --reinstall && \
    rm -r /var/lib/apt/lists/*

RUN  useradd -r -M -U -d /opt/countly -s /bin/false countly && \
	echo "countly ALL=(ALL) NOPASSWD: /usr/bin/sv restart countly-api countly-dashboard" >> /etc/sudoers.d/countly && \
	/opt/countly/bin/countly.install.sh

## Add MongoDB data volume
VOLUME ["/var/lib/mongodb"]

# Change MongoDB folder permissions and add services folders
RUN chown -R mongodb:mongodb /var/lib/mongodb && \
    mkdir /etc/service/mongodb && \
    mkdir /etc/service/nginx && \
    mkdir /etc/service/countly-api && \
    mkdir /etc/service/countly-dashboard && \
    echo "" >> /etc/nginx/nginx.conf && \
    echo "daemon off;" >> /etc/nginx/nginx.conf
        
# Add services' run scripts
ADD ./bin/commands/docker/mongodb.sh /etc/service/mongodb/run
ADD ./bin/commands/docker/nginx.sh /etc/service/nginx/run

ADD ./bin/commands/docker/countly-api.sh /etc/service/countly-api/run
ADD ./bin/commands/docker/countly-dashboard.sh /etc/service/countly-dashboard/run

# Only root can change run scripts
RUN chown mongodb /etc/service/mongodb/run && \
    chown root /etc/service/nginx/run && \
    chown -R countly:countly /opt/countly

EXPOSE 80

RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
