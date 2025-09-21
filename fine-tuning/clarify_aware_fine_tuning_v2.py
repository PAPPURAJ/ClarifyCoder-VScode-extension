
import argparse
import os
import sys
import torch
import torch.nn as nn
from transformers import Trainer, TrainingArguments, AutoModelForCausalLM, AutoTokenizer, DataCollatorForLanguageModeling, DataCollatorForSeq2Seq
from datasets import load_from_disk, load_dataset
from peft import (
    PeftModel,
    PeftConfig,
    LoraConfig,
    get_peft_model,
    get_peft_model_state_dict,
    prepare_model_for_kbit_training,
    set_peft_model_state_dict,
)
from sklearn.model_selection import train_test_split
from safetensors.torch import load_file

def merge_columns(example):
    example["prediction"] = example["quote"] + " ->: " + str(example["tags"])
    return example

def print_trainable_parameters(model):
    trainable_params = 0
    all_param = 0
    for name, param in model.named_parameters():
        all_param += param.numel()
        if param.requires_grad:
            trainable_params += param.numel()
    print(
        f"trainable params: {trainable_params} || all params: {all_param} || trainable%: {100 * trainable_params / all_param}"
    )

def tokenize_function(samples):
    return tokenizer(samples['problem'])

def tokenize_function2(samples):
    print(samples)
    

    return {'concatenated_text': concatenated_text}
def tokenize_v1(samples):
    concatenated_text = samples['problem'] + samples['answer']
    result = tokenizer(
        concatenated_text,
        truncation=True,
        max_length=512,
        padding=False,
        return_tensors=None,
    )
    result["labels"] = result["input_ids"].copy()
    return result
def tokenize_v2(samples):

    concatenated_text = samples['problem'] + samples['answer']
    result = tokenizer(
        concatenated_text,
        truncation=True,
        max_length=2048,
        padding=False,
        return_tensors=None,
    )
    

    problem_tokens = tokenizer(samples['problem'], truncation=True, max_length=512, padding=False, return_tensors=None)["input_ids"]
    answer_tokens = tokenizer(samples['answer'], truncation=True, max_length=512, padding=False, return_tensors=None)["input_ids"]
    answer_start_idx = len(problem_tokens)
    labels = [-100] * len(result["input_ids"])
    labels[answer_start_idx:answer_start_idx + len(answer_tokens)] = result["input_ids"][answer_start_idx:answer_start_idx + len(answer_tokens)]
    result["labels"] = labels

    return result
def tokenize_v3(samples):
    concatenated_text = samples['problem'] + samples['answer'] + samples['type']
    result = tokenizer(
        concatenated_text,
        truncation=True,
        max_length=512,
        padding=False,
        return_tensors=None,
    )
    result["labels"] = result["input_ids"].copy()
    return result
def tokenize_v4(samples):
    QPROMPT = "You are an expert software developer who writes high quality code. With below information, please either generate Python3 code (Respond directly with code only with markdown), or ask clarifying questions:\n"
    
    if samples['type'] == "Original":
        APROMPT = "This is a clear problem requiring no clarifications. Let's generate the required Python3 code directly in markdown."
    else:
        APROMPT = "I have a few clarifying questions. Please respond with the necessary details so I can assist further."
    
    concatenated_text = f"{QPROMPT} {samples['problem']}" + f"{APROMPT} {samples['answer']}"
    
    result = tokenizer(
        concatenated_text,
        truncation=True,
        max_length=2048, 
        padding=False,
        return_tensors=None,
    )
    
    result["labels"] = result["input_ids"].copy()
    return result

parser = argparse.ArgumentParser()
parser.add_argument('--model_name_or_path', type=str, help='Path to the model',required=True)
parser.add_argument('--finetune_method', type=str, default='lora', help='fine-tuning method')
parser.add_argument("-m","--model",help="LLM",type=str)
parser.add_argument('--use_int8', action='store_true', help='whether to use int8 quantization')
parser.add_argument('--use_fp16', action='store_true', help='whether to use fp16 precision')
parser.add_argument("--dataset_path",help="dataset_path",type=str,required=True)
parser.add_argument("--finetuned_model_path",help="finetuned_model_path",type=str,required=True)
parser.add_argument('--checkpoint', type=str, default="", help='checkpoint file')
parser.add_argument("--output_dir",type=str,required=True)
parser.add_argument('-bs','--per_device_train_batch_size', type=int, default=32)

parser.add_argument('--tokenize_version', type=int, choices=[1, 2, 3, 4], required=True, help='Select which tokenize function to use: 1, 2, or 3')

args = parser.parse_args()

if args.tokenize_version == 1:
    tokenize_fn = tokenize_v1
elif args.tokenize_version == 2:
    tokenize_fn = tokenize_v2
elif args.tokenize_version == 3:
    tokenize_fn = tokenize_v3
elif args.tokenize_version == 4:
    tokenize_fn = tokenize_v4

os.environ['CUDA_LAUNCH_BLOCKING'] = '1'
HF_HOME = "/scratch/jie"
offload_folder = "offload_folder"
if args.use_int8:
    print("**********************************")
    print("**** Using 8-bit quantization ****")
    print("**********************************")
    model = AutoModelForCausalLM.from_pretrained(
        args.model_name_or_path,
        load_in_8bit=True,
        device_map="auto",
        cache_dir=HF_HOME,
        offload_folder=offload_folder, 
        local_files_only=True,
        torch_dtype=torch.float16,
    )

elif args.use_fp16:
    print("**********************************")
    print("****** Using fp16 precision ******")
    print("**********************************")
    model = AutoModelForCausalLM.from_pretrained(
        args.model_name_or_path,
        device_map="auto",
        torch_dtype=torch.float16,
        cache_dir=HF_HOME,
        offload_folder=offload_folder,     
        local_files_only=True,     
    )

else:
    model = AutoModelForCausalLM.from_pretrained(
        args.model_name_or_path,
        device_map="auto",
        load_in_8bit=True,  
        local_files_only=True,          
        )
tokenizer = AutoTokenizer.from_pretrained(
    args.model_name_or_path,
    trust_remote_code=True,
    device_map='auto',
)
tokenizer.add_eos_token = True
tokenizer.pad_token_id = 0
tokenizer.padding_side = "left"
data = load_dataset('json', data_files=args.dataset_path, cache_dir='/scratch/jie')
tokenized_data = data.map(tokenize_fn)

print(data)
print(tokenized_data)
train_val_split = tokenized_data['train'].train_test_split(test_size=0.2, seed=42)
train_dataset = train_val_split['train']
val_dataset = train_val_split['test']
print(f"Training set size: {len(train_dataset)}")
print(f"Validation set size: {len(val_dataset)}")
print(train_dataset[0])
print(val_dataset[0])

resume_from_checkpoint = args.checkpoint

if resume_from_checkpoint:
    if os.path.exists(resume_from_checkpoint):
        print(f"Restarting from {resume_from_checkpoint}")

        
        


        peft_config = PeftConfig.from_pretrained(resume_from_checkpoint)
        model = PeftModel.from_pretrained(model, model_id=resume_from_checkpoint)
    else:
        print(f"Checkpoint {resume_from_checkpoint} not found")
model.train()
model = prepare_model_for_kbit_training(model)

config = LoraConfig(
    r=16,
    lora_alpha=16,
    target_modules=[
    "q_proj",
    "k_proj",
    "v_proj",
    "o_proj",
],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, config)

if torch.cuda.device_count() > 1:

    model.is_parallelizable = True
    model.model_parallel = True
print_trainable_parameters(model)
batch_size = 16
per_device_train_batch_size = 4
gradient_accumulation_steps = batch_size // per_device_train_batch_size
output_dir = args.output_dir

training_args = TrainingArguments(
        per_device_train_batch_size=per_device_train_batch_size,
        gradient_accumulation_steps=gradient_accumulation_steps,
        warmup_steps=100,
        max_steps=500,
        learning_rate=1e-5,
        fp16=True,
        logging_steps=10,
        optim="adamw_torch",
        evaluation_strategy="steps",
        save_strategy="steps",
        eval_steps=100,
        save_steps=100,
        output_dir=output_dir,

        load_best_model_at_end=False,

        group_by_length=True,
        report_to="none",
        run_name=None,
        remove_unused_columns=True,
    )

trainer = Trainer(
    model=model,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    args=training_args,
    data_collator=DataCollatorForSeq2Seq(
        tokenizer, pad_to_multiple_of=8, return_tensors="pt", padding=True
    ),
)

model.config.use_cache = False

old_state_dict = model.state_dict
if torch.__version__ >= "2" and sys.platform != "win32":
    print("compiling the model")
    model = torch.compile(model)
trainer.train()
results = trainer.evaluate()
print(results)

model.save_pretrained(args.finetuned_model_path)
model.save_pretrained(args.finetuned_model_path + '-bin', safe_serialization=False)

batch = tokenizer("Two things are infinite: ", return_tensors='pt').to('cuda') 

with torch.cuda.amp.autocast():
  output_tokens = model.generate(**batch, max_new_tokens=50)

print('\n\n', tokenizer.decode(output_tokens[0], skip_special_tokens=True))