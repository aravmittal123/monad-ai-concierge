import google.generativeai as genai
from web3 import Web3
import json

# --- CONFIGURATION ---
GEMINI_API_KEY = __import__("os").environ.get("GEMINI_API_KEY", "") 
MONAD_RPC_URL = "https://testnet-rpc.monad.xyz/" 
WALLET_ADDRESS = "0xdA6bEa0b5FCc4A3e46075f68E247f17d13A0899e" # REPLACE WITH YOUR FULL ADDRESS

# --- SETUP ---
genai.configure(api_key=GEMINI_API_KEY)
w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL))

if not w3.is_connected():
    print("❌ Error: Cannot connect to Monad Testnet.")
else:
    print("✅ Connected to Monad Testnet!")

# --- THE AI BRAIN FUNCTION ---
def get_balance_and_respond(user_prompt):
    # A. Get Real On-Chain Data
    try:
        balance_wei = w3.eth.get_balance(WALLET_ADDRESS)
        balance_mon = w3.from_wei(balance_wei, 'ether')
        chain_data = f"Current Balance: {balance_mon:.4f} MON"
    except Exception as e:
        chain_data = f"Error fetching balance: {e}"

    # B. Ask AI (Using the CORRECT model name)
    # Note: We use 'gemini-2.0-flash-exp' which is currently available for free
    model = genai.GenerativeModel('gemini-2.0-flash-exp') 
    
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
    
    result = get_balance_and_respond("How much money do I have?")
    print(f"\nUser: How much money do I have?")
    print(f"AI Response: {result}")