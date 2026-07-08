#!/usr/bin/env python3
import os
import sys
import subprocess
import venv
from pathlib import Path

def print_step(msg):
    print(f"\n🚀 {msg}")

def print_success(msg):
    print(f"✅ {msg}")

def main():
    base_dir = Path(__file__).resolve().parent
    venv_dir = base_dir / "venv"
    
    print_step("Inizializzazione del Data Layer di Race Dynamics...")
    
    # 1. Crea il Virtual Environment se non esiste
    if not venv_dir.exists():
        print_step("Creazione del Virtual Environment (venv)...")
        venv.create(venv_dir, with_pip=True)
        print_success("Virtual Environment creato con successo.")
    else:
        print_step("Virtual Environment già presente.")

    # 2. Determina il path dell'eseguibile di pip nel venv
    if os.name == "nt": # Windows
        pip_exe = venv_dir / "Scripts" / "pip.exe"
        python_exe = venv_dir / "Scripts" / "python.exe"
    else: # Mac/Linux
        pip_exe = venv_dir / "bin" / "pip"
        python_exe = venv_dir / "bin" / "python"

    if not pip_exe.exists():
        print("❌ Errore: Eseguibile pip non trovato nel venv.")
        sys.exit(1)

    # 3. Aggiorna pip
    print_step("Aggiornamento di pip...")
    subprocess.check_call([str(python_exe), "-m", "pip", "install", "--upgrade", "pip"])
    
    # 4. Installa le dipendenze da requirements.txt
    requirements_path = base_dir / "requirements.txt"
    if requirements_path.exists():
        print_step(f"Installazione delle dipendenze da {requirements_path.name}...")
        subprocess.check_call([str(pip_exe), "install", "-r", str(requirements_path)])
        print_success("Tutte le dipendenze sono state installate!")
    else:
        print("❌ Errore: requirements.txt non trovato.")
        sys.exit(1)

    # 5. Fine
    print("\n" + "="*50)
    print("🎉 SETUP COMPLETATO CON SUCCESSO! 🎉")
    print("="*50)
    
    if os.name == "nt":
        print("👉 Per attivare l'ambiente virtuale, esegui:")
        print("   .\\venv\\Scripts\\activate")
    else:
        print("👉 Per attivare l'ambiente virtuale, esegui:")
        print("   source venv/bin/activate")
        
    print("\n👉 Per avviare il backend locale:")
    print("   uvicorn app.main:app --reload")
    print("\n👉 Per lanciare uno script di estrazione dati:")
    print("   python -m scripts.ingest_session --session-key 9158 --year 2023")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
