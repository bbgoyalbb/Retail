"""Auto-generate a self-signed SSL certificate for the current machine IP."""
import ipaddress
import socket
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

out_dir = Path(__file__).parent

# Detect current local IP
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    local_ip = s.getsockname()[0]
    s.close()
except Exception:
    local_ip = "127.0.0.1"

print(f"Detected local IP: {local_ip}")

# Build SAN list — always include localhost + 127.0.0.1 + current LAN IP
san_entries = [
    x509.DNSName("localhost"),
    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
]
if local_ip != "127.0.0.1":
    san_entries.append(x509.IPAddress(ipaddress.IPv4Address(local_ip)))

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COMMON_NAME, "Retail App"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Narwana Agencies"),
])

cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.now(timezone.utc))
    .not_valid_after(datetime.now(timezone.utc) + timedelta(days=3650))
    .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
    .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
    .sign(key, hashes.SHA256())
)

(out_dir / "ssl.key").write_bytes(key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.TraditionalOpenSSL,
    serialization.NoEncryption(),
))
(out_dir / "ssl.crt").write_bytes(cert.public_bytes(serialization.Encoding.PEM))

print(f"Certificate regenerated for IP: {local_ip}")
