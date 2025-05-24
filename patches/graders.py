from distutils.log import debug
import json
import os
import html
import tempfile

import projects
from results import GraderResult, parse_non_zero_return_code
from zipfile import ZipFile
from base_grader import BaseGrader
from feedback_tools import Diff, set_feedback, get_input_sample
import graders_utils as gutils
from submission_requests import SubmissionRequest
from shutil import copyfile


class HDLGrader(BaseGrader):
    def __init__(self, submission_request, options):
        super(HDLGrader, self).__init__(submission_request)
        self.generate_diff = options.get("compute_diff", True)
        self.treat_non_zero_as_runtime_error = options.get("treat_non_zero_as_runtime_error", True)
        self.diff_tool = DiffWaveDrom(options)
        self.check_output = options.get('check_output', gutils.check_output)
        self.entity_name = options.get('entity_name', 'testbench')
        self.response_type = options.get('response_type','json')

    def create_project(self, testbench_file_name, golden_file_name):
        """
        Creates a project (VHDL or Verilog) to test the code
        """
        # Create factory project
        language_name = self.submission_request.language_name
        project_factory = projects.get_factory_from_name(language_name)

        # Create directory
        project_directory = tempfile.mkdtemp(dir=projects.CODE_WORKING_DIR)

        if self.submission_request.problem_type == 'code_multiple_languages':
            # Define the names of the 3 files
            file_names = {"students_code": "design", "testbench": "testbench", "teachers_code": "golden_model"}
            if language_name == 'verilog':
                code_file_name = os.path.join(project_directory, file_names["students_code"] + ".v")
                testbench_temp_name = os.path.join(project_directory, file_names["testbench"] + ".v")
                golden_temp_name = os.path.join(project_directory, file_names["teachers_code"] + ".v")
            elif language_name == 'vhdl':
                code_file_name = os.path.join(project_directory, file_names["students_code"] + ".vhd")
                testbench_temp_name = os.path.join(project_directory, file_names["testbench"] + ".vhd")
                golden_temp_name = os.path.join(project_directory, file_names["teachers_code"] + ".vhd")

            with open(code_file_name, "w+") as code_file:
                code_file.write(self.submission_request.code)
                copyfile(testbench_file_name, testbench_temp_name)
                copyfile(golden_file_name, golden_temp_name)

            if language_name == 'verilog':
                return project_factory.create_from_directory(project_directory, file_names)
            elif language_name == 'vhdl':
                return project_factory.create_from_directory(project_directory, self.entity_name, file_names)

        if self.submission_request.problem_type == 'code_file_multiple_languages':
            project_directory = tempfile.mkdtemp(dir=projects.CODE_WORKING_DIR)

            # Add source code to zip file
            with open(project_directory + ".zip", "wb") as project_file:
                project_file.write(self.submission_request.code)

            # Unzip all the files on the project directory
            with ZipFile(project_directory + ".zip") as project_file:
                project_file.extractall(path=project_directory)

            if language_name == 'verilog':
                # Add the testbench
                testbench_temp_name = tempfile.mkstemp(suffix=".v", dir=project_directory)[1]
                copyfile(testbench_file_name, testbench_temp_name)
                return project_factory.create_from_directory(project_directory)
            elif language_name == 'vhdl':
                testbench_temp_name = os.path.join(project_directory, testbench_file_name)
                copyfile(testbench_file_name, testbench_temp_name)
                return project_factory.create_from_directory(project_directory, self.entity_name)

    def grade(self, testbench_file_name, expected_output_name):
        """
        Creates, Runs ands Test the code from the user. Finally setting the feedback
        variables.
        """

        debug_info = {'files_feedback': {}}
        # Create the project
        project = self.create_project(testbench_file_name, expected_output_name)
        # Run the project
        try:
            project.build()
        except projects.BuildError as e:
            debug_info["compilation_output"] = e.compilation_output

        if "compilation_output" in debug_info:
            feedback_info = {'global': {}, 'custom': {}}
            feedback_info['global']['result'] = "failed"
            feedback_info['grade'] = 0.0
            compilation_output = debug_info.get("compilation_output", "")
            feedback_str = gutils.feedback_str_for_compilation_error(compilation_output,"hdl",self.response_type)
        else:
            results = project.run(None)
            res_type = self.response_type
            result, debug_info['files_feedback'][testbench_file_name], feedback_info = self._construct_feedback(results)
            test_cases = (testbench_file_name, expected_output_name)
            #Saving feedback as json  
            if res_type == 'json':
                feedback_list_json = []
                #for the test case we save the info for the html templates on the frontend
                feedback_obj = {
                    "i":0,
                    "result": result,
                    "test_case": test_cases,
                    "input_sample": get_input_sample(test_cases)
                }
                feedback_list_json.append(feedback_obj)
                # We save the container's options required for the feedback
                options_for_feedback = self.diff_tool.get_options_dict()
                options_for_feedback["container_type"] = "hdl"
                options_for_feedback["is_staff"] = self.submission_request.is_staff
                feedback_list_json.append(options_for_feedback)
                # We also save the debug info for the feedback
                feedback_list_json.append(debug_info)
                # Converting the list to a json format string
                # The json object always have this structure on hdl
                # [ feedback_obj_test_case , options_for_feedback , debug_info ]
                feedback_str_json = json.dumps(feedback_list_json)
                feedback_str = feedback_str_json
            #Saving feedback as rst
            elif res_type == 'rst':                
                feedback_str = self.diff_tool.hdl_to_html_block(0, result, test_cases, debug_info, self.submission_request.is_staff)

        feedback_info['global']['feedback'] = feedback_str
        set_feedback(feedback_info)
        # Return the grade and feedback of the code

    def _construct_feedback(self, results):
        # results contains the std output of the simulation of the golden model which is the expected output,
        # and the return_code, stdout and stderr of the simulation of the code in evaluation
        stdout_golden, result_evaluation = results
        return_code, stdout, stderr = result_evaluation

        feedback_info = {'global': {}, 'custom': {}}
        result = GraderResult.WRONG_ANSWER
        if return_code == 0:
            expected_output = stdout_golden
            correct = self.check_output(stdout, expected_output)
            feedback_info['global']['result'] = "success" if correct else "failed"
            feedback_info['grade'] = 100.0 if correct else 0.0
            if correct:
                result = GraderResult.ACCEPTED

        debug_info = {}

        diff = None
        if self.generate_diff:
            expected_output = stdout_golden
            diff = self.diff_tool.compute(stdout, expected_output)

        debug_info.update({
            "input_file": "",
            "stdout": html.escape(stdout),
            "stderr": html.escape(stderr),
            "return_code": return_code,
            "diff": None if diff is None else html.escape(diff),
        })
        return result, debug_info, feedback_info


def handle_problem_action(problem_id, testbench, output, options=None):
    sub_req = SubmissionRequest(problem_id)
    grader = HDLGrader(sub_req, options)
    grader.grade(testbench, output)


class DiffWaveDrom(Diff):
    def hdl_to_html_block(self, test_id, result, test_case, debug_info, is_staff):
        html_block = self.to_html_block(test_id, result, test_case, debug_info, is_staff)
        if html_block.find("updateDiffBlock") != -1:
            html_block = html_block.replace("updateDiffBlock", "updateWaveDromBlock")
        return html_block
