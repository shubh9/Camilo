from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
from supabase import create_client, Client
from services.ai_service import AiService
from services.simulate_ai_service import SimulateAiService

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure CORS
cors = CORS(
    app,
    resources={
        r"/*": {
            "origins": ["http://localhost:3000"],
            "methods": ["GET", "POST"],
            "allow_credentials": True
        }
    }
)

# Initialize Supabase
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# Initialize AI Service
ai_service = AiService()
simulate_ai_service = SimulateAiService()

@app.route('/')
def hello_world():
    return 'Hello World'

@app.route('/message', methods=['POST'])
def handle_message():
    try:
        data = request.json
        messages = data.get('messages', [])
        
        # Filter to get only user messages
        user_messages = [msg for msg in messages if not msg.get('isAI')]
        # Get the last 4 user messages
        last_user_messages = user_messages[-4:]
        
        # Get relevant context using the new method
        context = ai_service.get_relevant_context(last_user_messages)
        all_segments = context['all_segments']
        top_similar_questions = context['top_similar_questions']
        top_similar_conversations = context['top_similar_conversations']
        
        print('Generating response with context...')
        reply = ai_service.create_chat_completion(
            messages,
            all_segments,
            top_similar_questions,
            top_similar_conversations,
        )

        # Extract unique segment IDs and URLs from the context segments
        link_data = {segment['id']: segment['url'] for segment in all_segments}

        # Save the message and response to Supabase
        latest_user_message = user_messages[-1]
        supabase.table('messagesReceived').insert({
            'question': latest_user_message['content'],
            'answer': reply
        }).execute()

        return jsonify({
            'reply': reply,
            'linkData': link_data
        })

    except Exception as e:
        print(f'Error processing message: {str(e)}')
        return jsonify({'error': 'Failed to process message'}), 500

# @app.route('/simulateMessage', methods=['POST'])
# def handle_simulation():
#     try:
#         data = request.json
#         messages = data.get('messages', [])
#         is_user = data.get('isUser', False)
        
#         print('Generating simulated response...')
#         reply = simulate_ai_service.create_simulated_chat(
#             messages,
#             is_user
#         )

#         return jsonify({
#             'reply': reply,
#             'linkData': {}  # Empty since we're not using context
#         })

#     except Exception as e:
#         print(f'Error processing message: {str(e)}')
#         return jsonify({'error': 'Failed to process message'}), 500

if __name__ == '__main__':
    app.run(port=3001, debug=os.getenv('NODE_ENV') != 'production') 