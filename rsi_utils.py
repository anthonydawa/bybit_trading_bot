import numpy as np

def compute_rsi(data, period=14):
    # Extract closing prices (the 4th value in each list)
    closing_prices = [float(entry[4]) for entry in data]
    
    # Calculate price changes
    price_changes = np.diff(closing_prices)
    
    # Separate gains and losses
    gains = np.where(price_changes > 0, price_changes, 0)
    losses = np.where(price_changes < 0, -price_changes, 0)

    # Calculate average gain and average loss
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    # Apply smoothing for the next values in the period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    # Calculate the Relative Strength (RS)
    if avg_loss == 0:
        return 100  # If there's no loss, RSI is 100
    rs = avg_gain / avg_loss

    # Calculate the RSI
    rsi = 100 - (100 / (1 + rs))

    return rsi

