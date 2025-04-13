from kline_utils import get_kline_data


def get_vwap(kline_data):
    """
    Calculates the VWAP (Volume Weighted Average Price) for a given kline data.

    :param kline_data: List of tuples, where each tuple contains (timestamp, open, high, low, close, volume)
    :return: VWAP value as float
    """
    numerator = 0
    denominator = 0
    
    for kline in kline_data:
        close_price = float(kline[4])  # close price
        volume = float(kline[5])  # volume
        numerator += close_price * volume
        denominator += volume
    
    vwap = numerator / denominator if denominator != 0 else 0
    return vwap

# Example usage with kline data from your API

if __name__ == "__main__":
    kline_data = get_kline_data(symbol="BTCUSDT", interval=5, start=1736629200000,end=1736661600000)
    vwap_value = get_vwap(kline_data)
    print(f"VWAP Value: {vwap_value}")