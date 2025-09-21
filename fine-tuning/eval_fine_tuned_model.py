import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
MODEL_PATH = "/home/jie/clarify-aware-coder/fine-tuning/ANAD_deepseek-7B-exp4-bin-20241001T173940Z-001/ANAD_deepseek-7B-exp4-bin"
tokenizer = AutoTokenizer.from_pretrained("/project/def-fard/jie/deepseek-ai/deepseek-coder-6.7b-instruct")
model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, torch_dtype=torch.float16, device_map="auto")
model.eval()
def generate_response(input_text, max_length=512, temperature=0.7):
   inputs = tokenizer(input_text, return_tensors="pt").to("cuda")
  
   with torch.no_grad():
       outputs = model.generate(
           inputs["input_ids"],
           max_length=max_length,
           temperature=temperature,
           num_return_sequences=1,
           no_repeat_ngram_size=2,
           pad_token_id=tokenizer.eos_token_id
       )
  

   response = tokenizer.decode(outputs[0], skip_special_tokens=True)
   return response

input_text = "Digory and Polly are two kids living next door to each other. The attics of the two houses are connected to each other through a passage. Digory's Uncle Andrew has been secretly doing strange things in the attic of his house, and he always ensures that the room is locked. Being curious, Digory suspects that there is another route into the attic through Polly's house, and being curious as kids always are, they wish to find out what it is that Uncle Andrew is secretly up to.\n\nSo they start from Polly's house, and walk along the passageway to Digory's. Unfortunately, along the way, they suddenly find that some of the floorboards are missing, and that taking a step forward would have them plummet to their deaths below.\n\nDejected, but determined, they return to Polly's house, and decide to practice long-jumping in the yard before they re-attempt the crossing of the passage. It takes them exactly one day to master long-jumping a certain length. Also, once they have mastered jumping a particular length L, they are able to jump any amount less than equal to L as well.\n\nThe next day they return to their mission, but somehow find that there is another place further up the passage, that requires them to jump even more than they had practiced for. So they go back and repeat the process.\n\nNote the following:\n\n-  At each point, they are able to sense only how much they need to jump at that point, and have no idea of the further reaches of the passage till they reach there. That is, they are able to only see how far ahead is the next floorboard. \n-  The amount they choose to practice for their jump is exactly the amount they need to get across that particular part of the passage. That is, if they can currently jump upto a length L0, and they require to jump a length L1(> L0) at that point, they will practice jumping length L1 that day. \n-  They start by being able to \"jump\" a length of 1. \n\nFind how many days it will take them to cross the passageway. In the input, the passageway is described as a string P of '
response = generate_response(input_text)

print(f"Generated Response: {response}\n")