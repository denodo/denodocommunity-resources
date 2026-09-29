# denodo-linux-startup-scripts

Automated deployment script for configuring [Denodo Platform](https://community.denodo.com/kb/en/view/document/Linux%20startup%20scripts%20for%20Virtual%20DataPort,%20Scheduler%20and%20Web%20Tools) services on Linux via systemd.

**Works for Denodo Platform 7.0, 8.0, and 9+.**

*(Note: The raw systemd template files from the Denodo Knowledge Base are already included in the `templates/` directory for your convenience.)*

## Getting Started

By default, the script assumes your environment uses the following values:
* `DENODO_HOME`: `/opt/denodo`
* `DENODO_USER`: `denodo`
* `DENODO_GROUP`: `denodo`

### Option 1: Use Default Values
If your environment matches the defaults above, simply make the script executable and run it with sudo:

```bash
chmod +x setup.sh
sudo ./setup.sh
```

### Option 2: Use Custom Values

If your installation path or user/group is different, you can pass them as input parameters using the `-d` (directory), `-u` (user), and `-g` (group) flags.

For example:

```bash
chmod +x setup.sh
sudo ./setup.sh -d /home/myuser/Denodo/DenodoPlatform8 -u myuser -g myuser
```

*(Tip: You can run `./setup.sh -h` to see the help menu with all available options.)*

The script will automatically inject your installation path into all templates, deploy the files to their required directories, apply executable permissions, clean up any hidden Windows line endings, and reload the systemd daemon.

## Managing Services

Once the setup script finishes, you can manage your Denodo services using standard systemd commands:

```bash
# Start the main VQL Server
sudo systemctl start vqlserver.service

# Check the service status
sudo systemctl status vqlserver.service

# Enable the service to launch automatically on boot
sudo systemctl enable vqlserver.service
```


## License

This project is distributed under **Apache License, Version 2.0**. 

See [LICENSE](LICENSE)

## Support

This project is supported by **Denodo Community**. 

See [SUPPORT](SUPPORT.md)
