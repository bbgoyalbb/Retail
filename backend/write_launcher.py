"""Write a frontend launcher bat file. Usage: write_launcher.py <out_bat> <frontend_dir>"""
import sys

out_bat = sys.argv[1]
frontend_dir = sys.argv[2].rstrip("\\")

content = f'@echo off\nset HOST=0.0.0.0\nset HTTPS=true\nset BROWSER=none\ncd /d "{frontend_dir}"\nnpm start\n'
with open(out_bat, "w") as f:
    f.write(content)

print(f"Launcher written: {out_bat}")
print(f"Frontend dir: {frontend_dir}")
