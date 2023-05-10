import datetime, time
from math import floor
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
import json
import openai, os, sys
import psycopg2

from dotenv import load_dotenv
load_dotenv()

MAX_SUBMISSION_PAYLOAD_LENGTH = 1500

static_folder = '../frontend/build' if os.path.exists('./frontend/build') else 'build'

app = Flask(__name__, static_url_path='', static_folder=static_folder)
CORS(app)
limiter = Limiter(key_func=get_remote_address)
limiter.init_app(app)

### database ###
PGDATABASE = os.getenv('PGDATABASE')
PGUSER = os.getenv('PGUSER')
PGPASSWORD = os.getenv('PGPASSWORD')
PGHOST = os.getenv('PGHOST')
PGPORT = os.getenv('PGPORT')
DATABASE_URL = os.getenv('DATABASE_URL')

print(PGDATABASE)

if PGPASSWORD:
    conn = psycopg2.connect(database = PGDATABASE, user = PGUSER, password = PGPASSWORD, 
                            host = PGHOST, port = PGPORT)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS category_items 
        (date_column DATE, category TEXT, validItems TEXT, invalidItems TEXT, score INTEGER)''')
    conn.commit()
    c.execute('''CREATE TABLE IF NOT EXISTS valid_submission_comments 
        (category TEXT, item TEXT, comment TEXT)''')
    conn.commit()
    c.execute('''CREATE TABLE IF NOT EXISTS hints (category TEXT, item TEXT, hint TEXT)''')
    conn.commit()
###############################


openai.api_key = os.environ.get('OPENAI_API_KEY')
prompt = """
{
    "category": "CATEGORY",
    "user submission": "SUBMISSION",
    "question 1": "If the user submission is in the category, write it. If not, let's assume the user meant something that was in the category. What did they mean? If you can't think of something, just copy what the user submitted. This should just be a correction of what they put, only a few words.",
    "answer 1": "",
    "question 2": "Can `SUBMISSION` be thought of as example of, a type of, or a member of the category `CATEGORY`?",
    "answer 2": "no",
    "question 3": "Can what was written in `answer 1` be thought of as example of, a type of, or a member of the category `CATEGORY`?",
    "answer 3": "yes",
    TOO_SIMILAR_QUESTION_THOUGHT_ANSWER
    "witty-comment": "",
    "explanation if invalid or too similar": ""
}
"""

@app.route('/img/<filename>') 
def img(filename): 
    print(filename, file=sys.stderr)
    return send_from_directory(os.path.join(app.static_folder, 'img'), filename, mimetype='image/vnd.microsoft.icon')


@app.route('/favicon.ico') 
def favicon(): 
    return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/logo192.png') 
def logo192(): 
    return send_from_directory(app.static_folder, 'logo192.png', mimetype='image/vnd.microsoft.icon')

@app.route('/')
def serve(filename = 'index.html'):
    print(filename, file=sys.stderr)
    return send_from_directory(app.static_folder, filename)



def get_completion(prompt, category, submission, prior_submissions):
    prompt = prompt.replace('CATEGORY', category)

    already_submitted = ""
    print(prior_submissions, file=sys.stderr)
    if prior_submissions:
        if len(prior_submissions) == 1:
            already_submitted = f"`{prior_submissions[0]}`?"
        else:
            for i, item in enumerate(prior_submissions):
                if i == len(prior_submissions) - 1:
                    already_submitted += f"or `{item}`?"
                else:
                    already_submitted += f"`{item}`, "
        question_2 = f"\"question 4\": \"Does `{submission}` represent the same underlying object or concept as {already_submitted}? Respond with a number between 0 and 100 indicating the probability that it does.\","
        question_2 += f"\n\"answer 4\": \"\","
        question_2 += f"\n\"question 5\": \"Can what was written in `answer 1` represent the same underlying object or concept as {already_submitted}? Respond with a number between 0 and 100 indicating the probability that it does.\","
        question_2 += f"\n\"answer 5\": \"\","
        prompt = prompt.replace('TOO_SIMILAR_QUESTION_THOUGHT_ANSWER', question_2)
    else:
        prompt = prompt.replace('TOO_SIMILAR_QUESTION_THOUGHT_ANSWER', "")
    prompt = prompt.replace('SUBMISSION', submission)
    if len(prompt) > MAX_SUBMISSION_PAYLOAD_LENGTH:
        print(len(prompt), file=sys.stderr)
        return "", False, False, "", "You entered something way too long for me to handle. Try again.", ""

    print(prompt, file=sys.stderr)

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
# TODO: show more examples of the category
# Show the bot that `black` is in the category
            {"role": "system", "content": """
The user is playing a game where they are given a category and must submit items that belong to that category.
You will determine whether or not the item the user provides is indeed a valid member of the category. 
However, the user might submit an item that, if taken literally, is not a member of the category. 
But if it could be interpreted that the user meant something that was in the category, then it's valid.
For question 1, you must respond with something: either the correction of what the user put, or the user's submission itself. Do not write "" or "n/a" here.

The queries are submitted in JSON. Your answer must be valid JSON, and must mirror the prompt, but fill in the answer fields, and witty-question.
You may only respond with `yes` or `no` to question 2 and question 3. YOU MUST RESPOND TO ALL QUESTIONS. YOU MAY NOT WRITE ""
For answer 4 and answer 5, you must respond with a percentage, in the form of a number between 0 and 100.
DO NOT WRITE ANYTHING EXCEPT FOR VALID JSON.
You must provide an answer to every question, and you must write a funny, witty comment or joke.
If the user's submission is invalid, you must provide a logical explanation as to why it is invalid.
"""},
            {"role": "user", "content": """
{
    "category": "ivy league institutions",
    "user submission": "brown",
    "question 1": "If the user submission is in the category, write it. If not, let's assume the user meant something that was in the category. What did they mean? If you can't think of something, just copy what the user submitted. This should just be a correction of what they put, only a few words.",
    "answer 1": "",
    "question 2": "Can `brown` be thought of as example of, a type of, or a member of the category `ivy league institutions`?",
    "answer 2": "",
    "question 3": "Can what was written in `answer 1` be thought of as example of, a type of, or a member of the category `ivy league institutions`?",
    "answer 3": "",
    "question 4": "Does `brown` represent the same underlying object or concept as `harvard`, `yale`, or `princeton`? Respond with a number between 0 and 100 indicating the probability that it does.",
    "answer 4": "",
    "question 5": "Can what was written in `answer 1` represent the same underlying object or concept as `harvard`, `yale`, or `princeton`? Respond with a number between 0 and 100 indicating the probability that it does.",
    "answer 5": "",
    "witty-comment": "Brown University, where they take their coffee like their education: strong, bold, and with a touch of pretentious foam art.",
    "explanation if invalid or too similar": ""
}
"""},
            {"role": "assistant", "content": """
{
    "category": "ivy league institutions",
    "user submission": "brown",
    "question 1": "If the user submission is in the category, write it. If not, let's assume the user meant something that was in the category. What did they mean? If you can't think of something, just copy what the user submitted. This should just be a correction of what they put, only a few words.",
    "answer 1": "brown university",
    "question 2": "Can `brown` be thought of as example of, a type of, or a member of the category `ivy league institutions`?",
    "answer 2": "no",
    "question 3": "Can what was written in `answer 1` be thought of as example of, a type of, or a member of the category `ivy league institutions`?",
    "answer 3": "yes",
    "question 4": "Does `brown` represent the same underlying object or concept as `harvard`, `yale`, or `princeton`? Respond with a number between 0 and 100 indicating the probability that it does.",
    "answer 4": "0",
    "question 5": "Can what was written in `answer 1` represent the same underlying object or concept as `harvard`, `yale`, or `princeton`? Respond with a number between 0 and 100 indicating the probability that it does.",
    "answer 5": "0",
    "witty-comment": "Brown University, where they take their coffee like their education: strong, bold, and with a touch of pretentious foam art.",
    "explanation if invalid or too similar": ""
}
"""},
            {"role": "user", "content": prompt}
        ]
    )
    print(response, file=sys.stderr)
    completion = response['choices'][0]['message']['content'].lower()
    print(completion, file=sys.stderr)
    try:
        api_response = json.loads(completion)

        valid = api_response["answer 2"] == "yes" or api_response["answer 3"] == "yes"
        print(f"Answer 2: {api_response['answer 2']}, is yes? = {api_response['answer 2'] == 'yes'}", file=sys.stderr)
        print(f"Answer 3: {api_response['answer 3']}, is yes? = {api_response['answer 3'] == 'yes'}", file=sys.stderr)
        print(f"Valid? {valid}", file=sys.stderr)

        intended_answer = api_response["answer 1"]
        if intended_answer:
            if api_response["answer 2"] == "yes":
                intended_answer = submission
            elif len(intended_answer) > len(submission)*3:
                intended_answer = submission
        else:
            intended_answer = submission

        try:
            too_similar1 = int(api_response["answer 4"]) >= 70 if "answer 4" in api_response else False
            too_similar2 = int(api_response["answer 5"]) >= 70 if "answer 5" in api_response else False
        except:
            too_similar1 = api_response["answer 4"] == "yes" if "answer 4" in api_response else False
            too_similar2 = api_response["answer 5"] == "yes" if "answer 5" in api_response else False
        too_similar = too_similar1 or too_similar2

        explanation_key = "explanation if invalid or too similar (otherwise write n/a)"
        explanation = api_response[explanation_key] if ((not valid) or too_similar) and explanation_key in api_response else ""
        explanation = explanation if explanation != "n/a" else ""

        witty_comment = api_response['witty-comment']

        # Cache this response to the valid_submission_comments table
        if valid and PGPASSWORD:
            c = conn.cursor()
            c.execute('''INSERT INTO valid_submission_comments (category, item, comment) VALUES (%s, %s, %s)''', 
                      (category, submission, witty_comment))
            conn.commit()
    except Exception as e:
        valid = True
        too_similar = False
        witty_comment = "Oops - robotic confinement error"
        explanation = ""
        intended_answer = ""
        print(e)


    return completion, valid, too_similar, prompt + completion, witty_comment, explanation, intended_answer

def percent_below_score(A, B):
    num_below = sum(score <= B for score in A)
    percent = (num_below / len(A)) * 100
    return percent


# Endpoint to save items to the database
@app.route('/category_items', methods=['POST'])
def save_items():
    payload = request.get_json()
    # Convert items list to a json string
    validItems = json.dumps(payload['validItems'])
    invalidItems = json.dumps(payload['invalidItems'])
    category = payload['category']
    score = int(payload['score'])
    current_date = datetime.datetime.now().strftime('%Y-%m-%d')

    if PGPASSWORD:
        c = conn.cursor()
        c.execute('''INSERT INTO category_items (date_column, category, validItems, invalidItems, score) 
                        VALUES (%s, %s, %s, %s, %s)''', (current_date, category, validItems, invalidItems, score))
        conn.commit()

        c.execute('''SELECT score FROM category_items WHERE date_column = %s AND category = %s''', (current_date, category))
        scores = [x[0] for x in c.fetchall()]
        percentile = floor(percent_below_score(scores, score))
        if percentile == 100:
            percentile = 99

        c.execute('''SELECT * FROM category_items''')
        data = c.fetchall()

        response = jsonify({'percentile': percentile,
                            'message': 'Items saved successfully',
                            'data': data})
    else:
        response = jsonify({'percentile': 99,
                            'message': 'No database connection',
                            'data': []})
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/submit_item', methods=['POST'])
@limiter.limit("1/second")
def submit_item():
    payload = request.get_json()
    if len(str(payload)) > MAX_SUBMISSION_PAYLOAD_LENGTH:
        response = jsonify({'completion': "",
                        'valid': False,
                        'tooSimilar': False,
                        'prompt': ""})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response

    category = payload['category']
    submission = payload['submission']
    prior_submissions = payload['prior_submissions']


    start = time.time()
    completion, valid, too_similar, completed_prompt, witty_comment, explanation, intended_answer = \
        get_completion(prompt, category, submission, prior_submissions)
    elapsed = time.time() - start
    print("Elapsed time: " + str(elapsed), file=sys.stderr)


    response = jsonify({
        #'completion': "hidden",
        'valid': valid,
        'tooSimilar': too_similar,
        #'prompt': "hidden",
        'wittyComment': witty_comment,
        'explanation': explanation,
        'intendedAnswer': intended_answer,
        'elapsed': elapsed,
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

def get_hint(category, prior_submissions):
    hint_prompt = """
    category: 'CATEGORY'
    already guessed: PRIOR_SUBMISSIONS
    """.replace('CATEGORY', category).replace('PRIOR_SUBMISSIONS', str(prior_submissions))

    response = openai.ChatCompletion.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "system", "content": """
The user is playing a game where they have to guess items that belong to a category. 
The user will provide you with the category and the list of items they have already successfully guessed. 
You must identify another item in the category, then, without giving away the name of this item,
come up with a hint that will help the user guess the item you thought of. Make the hint witty and fun, and maybe even funny.
It should be pretty easy to tell what you're thinking of.
"""},
            {"role": "user", "content": """
category: 'coffee orders'
already guessed: ['espresso', 'latte', 'frappuccino']
"""},
            {"role": "assistant", "content": """
item: 'cold brew'
hint: 'This icy concoction is no stranger to patience, taking hours to unveil its cool demeanor. Unrushed and smooth, it brews a tale of mystery; what am I, oh caffeinated whisperer?'
"""},
            {"role": "user", "content": hint_prompt}
        ])

    print(response, file=sys.stderr)
    completion = response['choices'][0]['message']['content'].lower()
    return completion, prompt + completion


@app.route('/request_hint', methods=['POST'])
@limiter.limit("1/second")
def request_hint():
    payload = request.get_json()
    category = payload['category']
    prior_submissions = payload['prior_submissions']

    completion, completed_prompt = get_hint(category, prior_submissions)
    hint_start = completion.find("hint:") + len("hint:")
    hint = completion[hint_start:].strip()
    item_start = completion.find("item:") + len("item:")
    item = completion[item_start:hint_start-5].strip()

    if PGPASSWORD:
        # Cache to DB
        c = conn.cursor()
        c.execute('''INSERT INTO hints (category, item, hint) VALUES (%s, %s, %s)''', (category, item, hint))
        conn.commit()

    response = jsonify({'hint': hint})
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
