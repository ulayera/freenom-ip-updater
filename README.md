# freenom-ip-updater

Update your dynamic ip address automatically with this script, you need:

- your domain (can be one or more comma separated)
- your domain id (can be one or more comma separated)
- your freenom username
- your freenom password
- OPTIONAL: repeat interval in miliseconds

You can run this script with:

`node index.js DOMAIN DOMAIN_ID USERNAME PASSWORD [ FRECUENCY ]`

(it supports comma separated list of DOMAIN/DOMAIN_ID  `... mypage.com,otherpage.com 123456789,12356790 ...`)

or either use docker image:

````
docker run -d \
--name freenom \
-e FN_DOMAIN=DOMAIN \
-e FN_DOMAIN_ID=DOMAIN_ID \
-e FN_USERNAME=USERNAME \
-e FN_PASSWORD=PASSWORD \
-e FN_FRECUENCY=300000 \
--restart always \
ulayera/freenom-ip-updater

