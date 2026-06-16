

"""Crop tank from OG image and build PNG icon assets."""

from__future__importannotations

importos

frompathlibimportPath

fromPILimportImage

ROOT=Path(__file__).resolve().parents[1]

OG=ROOT/"assets"/"seo"/"og-image.png"

ICONS=ROOT/"assets"/"icons"

defkey_dark_background(img:Image.Image)->Image.Image:

    pixels=img.load()

width,height=img.size

foryinrange(height):

        forxinrange(width):

            r,g,b,a=pixels[x,y]

ifr<50andg<62andb<95:

                pixels[x,y]=(r,g,b,0)

returnimg

defmain()->None:

    ICONS.mkdir(parents=True,exist_ok=True)

img=Image.open(OG).convert("RGBA")

w,h=img.size

crop=img.crop((int(w*0.04),int(h*0.22),int(w*0.34),int(h*0.78)))

crop=key_dark_background(crop)

crop.save(ICONS/"tank-mark.png")

base=Image.new("RGBA",(512,512),(10,16,34,255))

foryinrange(512):

        t=y/511

col=(

int(10+(26-10)*t),

int(16+(60-16)*t),

int(34+(114-34)*t),

255,

)

forxinrange(512):

            base.putpixel((x,y),col)

tw,th=crop.size

scale=min(380/tw,280/th)

nw,nh=int(tw*scale),int(th*scale)

tank=crop.resize((nw,nh),Image.Resampling.LANCZOS)

ox,oy=(512-nw)//2,(512-nh)//2+20

base.alpha_composite(tank,(ox,oy))

base.save(ICONS/"logo-header.png")

base.save(ICONS/"apple-touch-icon.png")

base.save(ICONS/"icon-512.png")

print("Crop size:",crop.size)

if__name__=="__main__":

    main()

