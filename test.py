# Problem: Given a file, identify the lines on which there is a comment with the substring "ideaflow" (case insensitive)
file_path = "testFile.py"
try:
    with open(file_path, 'r') as file:
        code_text = file.read()
        comment = ""
        is_in_multiline_comment = False

        for index in range(len(code_text.splitlines())):
            line = code_text.splitlines()[index]

            if "'''" == line:
                is_in_multiline_comment = not is_in_multiline_comment
                if not is_in_multiline_comment:
                    print(f"Multiline comment: {comment}'''")
                    comment = ""

            if is_in_multiline_comment:
                comment += line
            else:
                if '"' in line:
                    line = line.split('"')[-1]
                if '#' in line:
                    comment = line.split('#')[1]
                    if "ideaflow" in comment:
                        print(f"Comment: {comment}")
                        comment = ""



except FileNotFoundError:
    print(f"Error: File not found at {file_path}")
    exit()
