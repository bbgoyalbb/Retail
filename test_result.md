#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

## user_problem_statement: Fix JobWork embroidery move button disabled state and continue fixing remaining frontend/backend issues
## frontend:
##   - task: "JobWork Embroidery Move Button Enable"
##     implemented: true
##     working: "NA"
##     file: "frontend/src/pages/JobWork.js"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         - working: "NA"
##         - agent: "main"
##         - comment: "Removed disabled={selected.length === 0} from forward move button in StatusColumn. Added window.alert in handleMove when no items selected. This fixes the iteration 5 test report issue where embroidery Required column move button was permanently disabled."
##
## backend:
##   - task: "Bulk Delete Items Body Parsing"
##     implemented: true
##     working: "NA"
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         - working: "NA"
##         - agent: "main"
##         - comment: "Added Body import to FastAPI and changed bulk_delete_items parameter from item_ids: List[str] to item_ids: List[str] = Body(...). Previously FastAPI treated this as a query parameter on the DELETE endpoint, but frontend sends the array in the request body via Axios. This caused bulk delete to silently delete 0 items."
##
##   - task: "JobWork Move Back embroidery_pay_mode Unset Fix"
##     implemented: true
##     working: "NA"
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         - working: "NA"
##         - agent: "main"
##         - comment: "Fixed move_jobwork_back endpoint: embroidery_pay_mode was incorrectly placed in $unset (removing the field entirely) instead of $set when reverting Finished -> In Progress. Now it sets embroidery_pay_mode to 'Pending' via $set."
##
##   - task: "Update Item Discount Calculation Mismatch"
##     implemented: true
##     working: "NA"
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         - working: "NA"
##         - agent: "main"
##         - comment: "Fixed update_item endpoint: fabric_amount recalculation used round((p - (p * d / 100)) * q, 0) which differs from create_bill that rounds the discounted unit price first. Changed to discounted_price = round(p - (p * d / 100), 0); update_fields['fabric_amount'] = round(discounted_price * q, 0) to match create_bill and frontend."
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 6
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "JobWork Embroidery Move Button Enable"
##     - "Bulk Delete Items Body Parsing"
##     - "JobWork Move Back embroidery_pay_mode Unset Fix"
##     - "Update Item Discount Calculation Mismatch"
##   stuck_tasks: []
##   test_all: false
##   test_priority: "high_first"
##
## agent_communication:
##     -agent: "main"
##     -message: "Fixed JobWork move button disabled state, bulk delete Body parsing, move-back embroidery_pay_mode unset bug, and update_item discount calculation mismatch. Retest required for all four fixes."