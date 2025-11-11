import hmac, hashlib, urllib.parse
from .config import settings

def validate_tma_init_data(init_data: str) -> dict:
    """
    Валидируем initData согласно Telegram Mini Apps:
    hash = HMAC_SHA256(secret_key, data_check_string)
    secret_key = sha256(bot_token)
    """
    # разбор querystring в dict (сохраняя исходный порядок для проверки)
    pairs = urllib.parse.parse_qsl(init_data, keep_blank_values=True)
    data = dict(pairs)
    received_hash = data.pop('hash', None)
    data_check_string = "\n".join([f"{k}={v}" for k, v in sorted(data.items())])
    secret_key = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()
    calc_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not received_hash or not hmac.compare_digest(calc_hash, received_hash):
        raise ValueError("Invalid initData")
    return data
