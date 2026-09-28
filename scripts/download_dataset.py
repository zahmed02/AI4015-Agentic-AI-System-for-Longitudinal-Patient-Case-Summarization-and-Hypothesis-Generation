'''
Downloads the MedChain dataset (ljwztc/MedChain) from Hugging Face Hub.
Public dataset - no HF token required.
'''
from huggingface_hub import snapshot_download
import os

DEST = os.path.join('data', 'raw', 'MedChain')
os.makedirs(DEST, exist_ok=True)

path = snapshot_download(
    repo_id='ljwztc/MedChain',
    repo_type='dataset',
    local_dir=DEST,
)

print(f'MedChain dataset downloaded to: {path}')
