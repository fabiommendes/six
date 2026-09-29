from logging import getLogger

log = getLogger("seks")


def sign(i: int) -> int:
    """
    Return -1, 0 or 1, depending o the sign of the input.
    """
    if i > 0:
        return 1
    elif i < 0:
        return -1
    else:
        return 0
