import google.generativeai as genai
from web3 import Web3
import json

# --- CONFIGURATION ---
# 1. Your Gemini API Key
GEMINI_API_KEY = __import__("os").environ.get("GEMINI_API_KEY", "") 

# 2. Monad Testnet RPC URL (This connects your code to the blockchain)
MONAD_RPC_URL = "https://testnet-rpc.monad.xyz/" 

# 3. Your Wallet Address (From your screenshot)
WALLET_ADDRESS = "0xdA6bEa0b5FCc4A3e46075f68E247f17d13A0899e" # REPLACE WITH YOUR FULL ADDRESS FROM METAMASK

# --- SETUP ---
genai.configure(api_key=GEMINI_API_KEY)
w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL))

# Check connection
if not w3.is_connected():
    print("❌ Error: Cannot connect to Monad Testnet. Check RPC URL.")
else:
    print("✅ Connected to Monad Testnet!")

# --- THE AI BRAIN FUNCTION ---
def get_balance_and_respond(user_prompt):
    # A. Get Real On-Chain Data
    try:
        balance_wei = w3.eth.get_balance(WALLET_ADDRESS)
        balance_mon = w3.from_wei(balance_wei, 'ether')
        chain_data = f"Current Balance: {balance_mon} MON"
    except Exception as e:
        chain_data = f"Error fetching balance: {e}"

    # B. Ask AI to process the user request WITH the real data
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    system_instruction = f"""
    You are an AI assistant for the Monad blockchain.
    Current User State: {chain_data}
    
    Your job is to answer the user's question or translate their intent into a JSON action.
    If they ask about their balance, use the 'Current User State' provided above.
    
    Output ONLY valid JSON. No markdown.
    Schema: {{ "response": "string", "action": "string (optional)" }}
    """
    
    response = model.generate_content(f"{system_instruction}\n\nUser: {user_prompt}")
    
    # Clean and return JSON
    try:
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except:
        return {"response": response.text, "action": None}

# --- TEST IT ---
if __name__ == "__main__":
    print("\n--- Testing AI Agent ---")
    
    # Test 1: Ask about balance
    result = get_balance_and_respond("How much money do I have?")
    print(f"\nUser: How much money do I have?")
    print(f"AI: {result}")
    
    # Test 2: Ask to swap
    result = get_balance_and_respond("I want to swap 5 MON for USDC")
    print(f"\nUser: I want to swap 5 MON for USDC")
    print(f"AI: {result}")