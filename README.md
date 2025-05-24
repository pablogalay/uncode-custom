# UNCode Patch Script

This repository contains the files and scripts needed to apply custom modifications to the UNCode + INGInious system.

---

## ✅ Requirements

- **Ubuntu 22.04 LTS**
- **Python 3.6** using a **Conda environment** (`python3.6_uncode`)
- **Docker** properly installed and running
- Docker containers based on:
  - `unjudge/hdl-uncode`
  - `ingi/inginious-c-verilog`

---

## 🔧 Step 1: Install the Base Platform

Before applying any patches, you must set up the original INGInious platform. Follow these instructions **exactly**:

```bash
# Update and install dependencies
sudo apt update
sudo apt upgrade
sudo apt install git gcc tidy python3-pip python3-dev python3-venv libzmq3-dev apt-transport-https
sudo apt install curl gnupg lsb-release

# Install Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install docker-ce docker-ce-cli

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
wget http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_amd64.deb
sudo dpkg -i libssl1.1_1.1.1f-1ubuntu2_amd64.deb
sudo apt install -y mongodb-org

# Start and enable services
sudo systemctl daemon-reexec
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl start docker
sudo systemctl enable docker
sudo groupadd docker
sudo usermod -aG docker $USER
sudo reboot
```
After reboot:
```bash
# Install Miniconda
mkdir -p ~/miniconda3
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda3/miniconda.sh
bash ~/miniconda3/miniconda.sh -b -u -p ~/miniconda3
rm -rf ~/miniconda3/miniconda.sh
~/miniconda3/bin/conda init

# Open a new terminal or source bash
conda create --name python3.6_uncode python=3.6
conda activate python3.6_uncode
pip install --upgrade git+https://github.com/JuezUN/INGInious.git
pip install pymongo==3.12.1

# Pull required grading containers
docker pull ingi/inginious-c-verilog
docker pull unjudge/hdl-uncode
```
Update your INGInious configuration file at ~/uncode/configuration.yaml with:
```bash
backend: local
backup_directory: .
local-config: {}
mongo_opt:
  database: INGInious
  host: localhost
plugins:
  - plugin_module: inginious.frontend.plugins.scoreboard
  - plugin_module: inginious.frontend.plugins.grader_generator
  - plugin_module: inginious.frontend.plugins.code_preview
  - plugin_module: inginious.frontend.plugins.task_editorial
  - plugin_module: inginious.frontend.plugins.task_hints
  - plugin_module: inginious.frontend.plugins.multilang
    show_tools: true
    use_wavedrom: true
superadmins:
  - superadmin
tasks_directory: .
use_minified_js: false
```
## 🧩 Step 2: Apply the Custom Patches

Once the base platform is installed, apply the custom patches:

```bash
git clone https://github.com/your_username/uncode-custom.git
cd uncode-custom
chmod +x patch_system.sh
./patch_system.sh
```
The patch_system.sh script performs the following:

- Locates and modifies system-wide files like graders.py and feedback_tools.py
- Updates frontend plugins such as parsable_text.py and hdlgrader.js
- Clears Python bytecode caches (__pycache__) after changes
- No need to modify or regenerate hdlgrader.min.js if use_minified_js: false is set
