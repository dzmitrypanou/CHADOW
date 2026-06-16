

"""Подготовка дампа u2668592_abs.sql для импорта в chadow."""

from__future__importannotations

importre

importsys

frompathlibimportPath

defprepare_dump(text:str)->str:

    fortablein("ad_images","ads"):

        text=re.sub(

rf"-- Table structure for table `{table}`.*?(?=-- Table structure for table `)",

"",

text,

flags=re.DOTALL,

)

text=re.sub(

r",?\s*CONSTRAINT `[^`]+` FOREIGN KEY \([^)]+\) REFERENCES `[^`]+` \([^)]+\)"

r"(?: ON DELETE (?:CASCADE|RESTRICT|SET NULL))?",

"",

text,

)

text=re.sub(r",\s*\n\s*\)","\n)",text)

returntext

defmain()->int:

    root=Path(__file__).resolve().parent

src=Path(sys.argv[1])iflen(sys.argv)>1elseroot.parent.parent/"Downloads"/"u2668592_abs.sql"

dst=Path(sys.argv[2])iflen(sys.argv)>2elseroot/"chadow_import.sql"

ifnotsrc.is_file():

        print(f"Файл не найден: {src}",file=sys.stderr)

return1

prepared=prepare_dump(src.read_text(encoding="utf-8"))

dst.write_text(prepared,encoding="utf-8")

print(f"OK: {dst} ({dst.stat().st_size} bytes)")

return0

if__name__=="__main__":

    raiseSystemExit(main())

