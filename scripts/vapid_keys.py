"""Make the keys the daily reminder needs, and print the lines to put in .env."""

import base64

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid

v = Vapid()
v.generate_keys()
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
public = v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
private = v.private_key.private_numbers().private_value.to_bytes(32, "big")
print(f"VAPID_PUBLIC_KEY={b64(public)}\nVAPID_PRIVATE_KEY={b64(private)}\nVAPID_SUBJECT=mailto:you@example.com")
