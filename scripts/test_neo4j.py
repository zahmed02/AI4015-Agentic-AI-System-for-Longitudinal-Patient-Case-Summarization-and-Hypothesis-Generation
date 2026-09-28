from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()

URI = os.getenv("NEO4J_URI")
USER = os.getenv("NEO4J_USERNAME")
PASSWORD = os.getenv("NEO4J_PASSWORD")

driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

def test_connection(tx):
    result = tx.run("RETURN 'Neo4j connection successful!' AS msg")
    return result.single()["msg"]

with driver.session() as session:
    print(session.execute_read(test_connection))

driver.close()