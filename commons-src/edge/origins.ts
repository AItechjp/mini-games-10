// Explicit service hosts only; never accept every subdomain or suffix matches.
export const serviceHosts=['canvas','law','talk','stay','sumai','market','tokai-sauna','sento','sakana','ramen','sauna','ramen-news','sauna-news','camera','weather','btc','onion'] as const;
export const allowedOrigins=new Set(['https://aitechd.com','https://www.aitechd.com',...serviceHosts.map(host=>`https://${host}.aitechd.com`)]);
