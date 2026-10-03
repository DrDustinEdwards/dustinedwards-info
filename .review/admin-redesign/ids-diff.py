import re, sys, urllib.request, html
A="http://localhost:4174"; B="http://localhost:4173"   # main, branch
def get(base,p):
    try:
        r=urllib.request.urlopen(base+p,timeout=30); return r.status, r.read().decode("utf8","replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf8","replace")
st,site=get(B,"/sitemap.xml")
paths=set(re.findall(r"<loc>https?://[^/]+(/[^<]*)</loc>",site))
paths|={"/","/search","/colophon","/privacy","/contact","/cv","/about","/this-page-is-not-here","/writing/nope-post","/research/protocols/nope","/teaching/phage-discovery","/writing","/research","/software","/teaching"}
paths=sorted(paths)
def ids(h): return re.findall(r'\sid="([^"]*)"',h)
diffs=0; same=0; status_diff=0
for p in paths:
    sa,ha=get(A,p); sb,hb=get(B,p)
    if sa!=sb: status_diff+=1; print("STATUS",p,sa,sb)
    ia,ib=ids(ha),ids(hb)
    if sorted(ia)!=sorted(ib):
        diffs+=1
        print("IDS DIFFER",p,"only main:",sorted(set(ia)-set(ib))[:10],"only branch:",sorted(set(ib)-set(ia))[:10],"counts",len(ia),len(ib))
    else: same+=1
print(f"{len(paths)} public routes: {same} with identical ids, {diffs} differ, {status_diff} status differences")
