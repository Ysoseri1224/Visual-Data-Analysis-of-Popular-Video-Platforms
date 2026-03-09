# 读取1.txt文件，在每行URL的https前和pc_search后添加双引号，并输出到2.txt

def process_url_file(input_file, output_file):
    # 读取输入文件
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # 处理每一行，添加双引号
    processed_lines = []
    for line in lines:
        line = line.strip()
        if line:  # 跳过空行
            # 查找pc_search的位置
            pc_search_pos = line.find('pc_search')
            if pc_search_pos != -1:
                # 在https前添加双引号，在pc_search后添加双引号
                processed_line = '"' + line[:pc_search_pos+9] + '"'
                processed_lines.append(processed_line)
    
    # 写入输出文件
    with open(output_file, 'w', encoding='utf-8') as f:
        for line in processed_lines:
            f.write(line + '\n')

# 指定输入和输出文件路径
input_file = 'D:\\DESKTOP\\my\\project\\chatbot-analysis\\MediaCrawler\\1.txt'
output_file = 'D:\\DESKTOP\\my\\project\\chatbot-analysis\\MediaCrawler\\2.txt'

# 执行处理
process_url_file(input_file, output_file)
print(f"处理完成，已将结果保存到 {output_file}")