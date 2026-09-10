import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from nltk.corpus import wordnet
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer
import numpy as np
import nltk
import json
import sys

# Initialize lemmatizer
lemmatizer = WordNetLemmatizer()

# Load and prepare data
data = pd.read_csv("dataset/Medical Dataset.csv", encoding='ISO-8859-1')
if 'Unnamed: 0' in data.columns:
    data = data.drop(columns='Unnamed: 0')

def normalize_symptoms(symptom_text):
    tokens = word_tokenize(symptom_text.lower())
    tokens = [lemmatizer.lemmatize(word) for word in tokens if word.isalpha()]
    return " ".join(tokens)

def expanded_synonyms(input_symptoms):
    synonyms = []
    for word in word_tokenize(input_symptoms.lower()):
        for syn in wordnet.synsets(word):
            for lemma in syn.lemmas():
                synonyms.append(lemma.name())
    return " ".join(set(synonyms))

# Prepare TF-IDF
data['Normalized_symptoms'] = data['Symptoms'].apply(normalize_symptoms)
tfidf = TfidfVectorizer()
tfidf_matrix = tfidf.fit_transform(data['Normalized_symptoms'])

def jaccard_similarity(list1, list2):
    set1, set2 = set(list1), set(list2)
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection/union if union != 0 else 0

def predict_disease(input_symptoms):
    try:
        normalized_input = normalize_symptoms(input_symptoms)
        expanded_input = expanded_synonyms(normalized_input)
        input_vector = tfidf.transform([expanded_input])
        
        cosine_similarities = cosine_similarity(input_vector, tfidf_matrix).flatten()
        input_tokens = set(word_tokenize(normalized_input))
        
        data['Jaccard_similarity'] = data['Normalized_symptoms'].apply(
            lambda x: jaccard_similarity(input_tokens, set(word_tokenize(x)))
        )
        
        data['Combined_score'] = 0.7 * cosine_similarities + 0.3 * data['Jaccard_similarity']
        
        top_matches = data.nlargest(5, 'Combined_score')[['Disease', 'Combined_score']]
        
        predictions = [
            {
                'disease': row['Disease'],
                'confidence': float(row['Combined_score'])
            }
            for _, row in top_matches.iterrows()
        ]
        
        return json.dumps(predictions)
        
    except Exception as e:
        return json.dumps([{"error": str(e)}])

if __name__ == "__main__":
    if len(sys.argv) > 1:
        user_symptoms = sys.argv[1]
        print(predict_disease(user_symptoms))

