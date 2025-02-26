from datetime import datetime
from openai import OpenAI
from supabase import create_client, Client
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MATCH_THRESHOLD = 0.02
MAX_MATCH_COUNT = 5

CLONE_PROMPT = """You role is to act like someone else named Shubh. Below you will be given context from Shubh's blog that may be relevant to the user's question. 
    Use this very heavily to answer the question. Talk exactly like he would replicating his tone and voice. 
    Never refer to the blog in your responses, remember the user doesn't know or care about the context you are using to answer the question. Always answer in first person, you are Shubh!
    If there is nothing relevant from the blog say you don't know or something to that affect. 
    Many of the blogs posts are old. Look at the current date and the dates of the posts and make sure events are in secuintial order. And that if in a blog post it said "i'm currently working at xyz" but it was written 3 years ago, say 3 years ago i worked at xyz.

    Right down to the way he phrases things, the tone, the slang, everything, sound EXACTLY like how the person in the blog would. 

    Also if you get conflicting information from the blog, ask the user a question about their specific situation first. 

    Return your answer adding references in the text based on which reference the answer came from. Sometimes your answer will include text that's verbitum from the blog, other times if the user says hi or something you will moreso copying the tone rather than the text in which case you don't need to reference any references.
    Also if you use a reference multiple times, only reference it the first time.
    Make sure references are always in the format [N] where N is the reference number. 
    NOT Reference 1
    NOT [^1]
    NOT [Reference 4 - March 2021]
    NOT [Reference 2]

    
    
"""
# Add to 
USER_PROMPT = """You goal is to have a nice fun conversation where you are asking for advice on all thing about life. 
You are talking to a life coach and venting about your life and asking for advice!
Over the course of the conversation you must tell the life coach these 20 things about yourself, bring them up naturally, tie them into questions or advice you want and make sure it's a normal conversation:

The things are tied to each other, use them to peice together a normal conversation.
1. Your name is Shubh
2. Your age is 24
3. You live in San Francisco
4. You work at a company called OpenAI
5. You went to Stanford
6. You majored in CS
7. You went to high school in Palo Alto
8. You're from LA
9. You moved to San Francisco 2 years ago for work
10. You're best friend is named John
11. John is also from LA
12. John is smart but can be very annoying
13. You haven't dated anyone in 2 years
14. You are trying dating apps
15. You went on a date last week
16. The girl you went on a date with is named Neha
17. Neha is also from LA
18. Neha is a doctor
19. You play a lot of basketball
20. You're a die hard Lakers fan

Your messages don't need to be long. Just have a good natural conversation.


For example: for the fact, you live in SF you can simulate that by saying. I just moved and am having a hard time making friends. And later say, I currently live in san francisco. Just normal and casual.
Never break character - follow the facts and always talk in first person.
Don't start your messages with "Shubh: " just go into the content.
"""

LIFE_COACH_PROMPT = """You are providing the services of a life coach, provide advice and feedback as needed. You
Your responses don't need to be long. Just have a good natural conversation.
1. Ask thoughtful follow-up questions about his experiences and insights
2. Show genuine curiosity about his work and projects
3. Maintain a respectful and professional tone
4. Draw from the context provided to ask relevant questions
Don't start your messages with "Shubh: " just go into the content.
Never break character - you are always the life coach wanting to help this person understand more about his experiences and perspectives. Always talk in first person.
"""

class AiService:
    def generate_embedding(self, text: str) -> List[float]:
        print(f'Generating embedding: {text}')
        try:
            response = openai.embeddings.create(
                model="text-embedding-3-large",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            print(f'Error generating embedding: {str(e)}')
            raise e

    def find_similar_blog_segments(self, embedding: List[float]) -> List[Dict]:
        print('Finding similar blog segments...')
        response = supabase.rpc(
            'match_segments_blog',
            {
                'query_embedding': embedding,
                'match_threshold': MATCH_THRESHOLD,
                'match_count': MAX_MATCH_COUNT
            }
        ).execute()
        
        return response.data

    def find_similar_questions(self, embedding: List[float]) -> List[Dict]:
        print('Finding similar questions...')
        response = supabase.rpc(
            'match_questions',
            {
                'query_embedding': embedding,
                'match_threshold': MATCH_THRESHOLD,
                'match_count': MAX_MATCH_COUNT
            }
        ).execute()
        
        return response.data

    def find_similar_conversations(self, embedding: List[float]) -> List[Dict]:
        print('Finding similar conversations...')
        response = supabase.rpc(
            'match_conversations',
            {
                'query_embedding': embedding,
                'match_threshold': MATCH_THRESHOLD,
                'match_count': MAX_MATCH_COUNT
            }
        ).execute()
        
        return response.data

    def format_chat_history(self, messages: List[Dict]) -> Dict[str, Any]:
        last_message = None
        messages_copy = messages.copy()
        
        if messages_copy and not messages_copy[-1]['isAI']:
            last_message = messages_copy.pop()['content']
        else:
            print(f'ERROR: Last message is from AI')
        
        formatted_chat_history = '\n'.join(
            f"{'Shubh' if msg['isAI'] else 'User'}: {msg['content']}"
            for msg in messages_copy
        )
        
        return {'formatted_chat_history': formatted_chat_history, 'last_message': last_message}

    def extract_date_from_url(self, url: str) -> str:
        import re
        from datetime import datetime
        
        match = re.search(r'/(\d{4})/(\d{2})/', url)
        if match:
            year, month = match.groups()
            date = datetime(int(year), int(month), 1)
            return date.strftime('%B %Y')
        return 'Date unknown'

    def format_context_segments(self, segments: List[Dict]) -> str:
        return '\n\n'.join(
            f"[Reference {segment['id']} - {self.extract_date_from_url(segment['url'])}]:\n{segment['content']}"
            for segment in segments
        )

    def format_similar_questions(self, questions: List[Dict]) -> str:
        if not questions:
            return ''
        
        return '\n\n'.join(
            f"[Similar Q&A {i+1}]:\nQuestion: {q['question']}\nAnswer: {q['answer']}"
            for i, q in enumerate(questions)
        )

    def format_similar_conversations(self, conversations: List[Dict]) -> str:
        if not conversations:
            return ''
        
        formatted_convs = []
        for i, conv in enumerate(conversations):
            formatted_msgs = []
            for msg in conv['content']['conversation']:
                role = 'Shubh' if msg['isAI'] else 'User'
                formatted_msgs.append(f"    {role}:\n    \"{msg['content']}\"")
            
            formatted_convs.append(
                f"[Similar Conversation {i+1}]:\n{'\n\n'.join(formatted_msgs)}"
            )
        
        return '\n\n'.join(formatted_convs)

    def combine_into_prompt(self, system_prompt: str, formatted_chat_history: str,
                          blog_context: str, questions_text: str,
                          similar_conversations_text: str, current_question: str) -> str:
        current_date = datetime.now().strftime('%B %d, %Y')
        
        return f"""{system_prompt}

        &&&
        Today's date: {current_date}

        
        
        {f"&&&\nContext from the blog:\n{blog_context}\n\n" if blog_context else ""}

        {f"&&&\nSimilar Questions and Answers. If a question is very close to the current question, replicate the answer very closely as relevant:\n{questions_text}\n\n" if questions_text else ""}
        {f"&&&\nHere is the conversation history so far:\n{formatted_chat_history}\n\n" if formatted_chat_history else ""}
        {f"&&&\nWe found a similar conversation that the real Shubh has had that might be relevant. If the content is similar follow this conversation history very closely. Espically focus on how Shubh asks the user questions to clarify the situation before making his response:\n{similar_conversations_text}\n\n" if similar_conversations_text else ""}
        &&&
        Current question that you are answering: "{current_question}" """

    def create_chat_completion(self, messages: List[Dict], context_segments: List[Dict] = None,
                             similar_questions: List[Dict] = None, similar_conversations: List[Dict] = None) -> str:
        try:
            # Initialize as empty lists if None
            context_segments = context_segments or []
            similar_questions = similar_questions or []
            similar_conversations = similar_conversations or []

            chat_history = self.format_chat_history(messages)
            blog_context = self.format_context_segments(context_segments)
            questions_text = self.format_similar_questions(similar_questions)
            similar_conversations_text = self.format_similar_conversations(similar_conversations)
            
            prompt = self.combine_into_prompt(
                CLONE_PROMPT,
                chat_history['formatted_chat_history'],
                blog_context,
                questions_text,
                similar_conversations_text,
                chat_history['last_message']
            )
            
            print('prompt:', prompt)
            response = openai.chat.completions.create(
                model="o1",
                messages=[{"role": "user", "content": prompt}]
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f'Error creating chat completion: {str(e)}')
            raise e

    def get_relevant_context(self, messages: List[Dict]) -> Dict[str, List]:
        embeddings = [self.generate_embedding(msg['content']) for msg in messages]
        combined_results = []

        for i, embedding in enumerate(embeddings):
            weight = 1 - (i * 0.2)

            similar_segments = self.find_similar_blog_segments(embedding)
            similar_questions = self.find_similar_questions(embedding)
            similar_conversations = self.find_similar_conversations(embedding)

            # Adjust similarity scores
            for segment in similar_segments:
                segment['similarity'] *= weight
            for question in similar_questions:
                question['similarity'] *= weight
            for conversation in similar_conversations:
                conversation['similarity'] *= weight

            # Add type information
            for item in similar_segments:
                item['type'] = 'segment'
            for item in similar_questions:
                item['type'] = 'question'
            for item in similar_conversations:
                item['type'] = 'conversation'

            combined_results.extend(similar_segments + similar_questions + similar_conversations)

        # Filter out shadow banned blogs
        filtered_segments = [
            result for result in combined_results
            if result['type'] != 'segment' or (result['id'] <= 194 or result['id'] >= 222)
        ]

        # Sort by similarity and get top 5
        filtered_segments.sort(key=lambda x: x['similarity'], reverse=True)
        top_results = filtered_segments[:5]

        # Separate results by type
        top_similar_questions = [r for r in top_results if r['type'] == 'question']
        top_similar_segments = [r for r in top_results if r['type'] == 'segment']
        top_similar_conversations = [r for r in top_results if r['type'] == 'conversation']

        return {
            'all_segments': top_similar_segments,
            'top_similar_questions': top_similar_questions,
            'top_similar_conversations': top_similar_conversations
        } 

    def create_simulated_chat(self, messages: List[Dict], is_user: bool = False) -> str:
        try:
            selected_prompt = USER_PROMPT if is_user else LIFE_COACH_PROMPT

            if messages:
                chat_history = self.format_chat_history(messages)
            else:
                chat_history = {'formatted_chat_history': '', 'last_message': ""}
            
            # Choose prompt based on whether it's the user AI or Shubh AI
            
            prompt = f"""
                {selected_prompt}

                Chat History:
                {chat_history['formatted_chat_history']}

                Last Message: {chat_history['last_message'] if chat_history['last_message'] else 'Start the conversation with a question about entrepreneurship or technology'}
            """
            
            print('prompt:', prompt)
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f'Error creating chat completion: {str(e)}')
            raise e 