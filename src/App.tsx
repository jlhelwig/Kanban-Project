/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { Plus, Trash2, GripVertical, CheckCircle2, Circle, Clock, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from './lib/utils';
import { GoogleGenAI } from "@google/genai";

// --- Types ---

type ColumnId = 'todo' | 'doing' | 'done';

interface Task {
  id: string;
  content: string;
  description?: string;
  createdAt: number;
}

interface KanbanData {
  tasks: Record<string, Task>;
  columns: Record<ColumnId, {
    id: ColumnId;
    title: string;
    taskIds: string[];
  }>;
  columnOrder: ColumnId[];
}

// --- Initial Data ---

const initialData: KanbanData = {
  tasks: {
    'task-1': { id: 'task-1', content: 'Design the UI', description: 'Create wireframes and high-fidelity designs.', createdAt: Date.now() },
    'task-2': { id: 'task-2', content: 'Setup project', description: 'Initialize repository and install dependencies.', createdAt: Date.now() - 10000 },
  },
  columns: {
    'todo': {
      id: 'todo',
      title: 'To Do',
      taskIds: ['task-1'],
    },
    'doing': {
      id: 'doing',
      title: 'Doing',
      taskIds: ['task-2'],
    },
    'done': {
      id: 'done',
      title: 'Done',
      taskIds: [],
    },
  },
  columnOrder: ['todo', 'doing', 'done'],
};

// --- Components ---

export default function App() {
  const [data, setData] = useState<KanbanData>(() => {
    const saved = localStorage.getItem('kanban-data');
    return saved ? JSON.parse(saved) : initialData;
  });

  const [newTaskContent, setNewTaskContent] = useState('');
  const [isAddingTo, setIsAddingTo] = useState<ColumnId | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  useEffect(() => {
    localStorage.setItem('kanban-data', JSON.stringify(data));
  }, [data]);

  const suggestTask = async () => {
    if (isSuggesting) return;
    setIsSuggesting(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
      }

      const genAI = new GoogleGenAI({ apiKey });
      const model = genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on these current tasks: ${(Object.values(data.tasks) as Task[]).map(t => t.content).join(', ')}, suggest ONE new, relevant task for a project. 
        Return ONLY the task name, no other text. Keep it under 50 characters.`,
      });

      const response = await model;
      const suggestion = response.text?.trim();

      if (suggestion) {
        const taskId = `task-${Date.now()}`;
        const newTask: Task = {
          id: taskId,
          content: suggestion,
          createdAt: Date.now(),
        };

        const column = data.columns['todo'];
        const newTaskIds = [...column.taskIds, taskId];

        setData({
          ...data,
          tasks: {
            ...data.tasks,
            [taskId]: newTask,
          },
          columns: {
            ...data.columns,
            ['todo']: {
              ...column,
              taskIds: newTaskIds,
            },
          },
        });
      }
    } catch (error) {
      console.error('Error suggesting task:', error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const start = data.columns[source.droppableId as ColumnId];
    const finish = data.columns[destination.droppableId as ColumnId];

    // Moving within the same column
    if (start === finish) {
      const newTaskIds = Array.from(start.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);

      const newColumn = {
        ...start,
        taskIds: newTaskIds,
      };

      setData({
        ...data,
        columns: {
          ...data.columns,
          [newColumn.id]: newColumn,
        },
      });
      return;
    }

    // Moving from one column to another
    const startTaskIds = Array.from(start.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStart = {
      ...start,
      taskIds: startTaskIds,
    };

    const finishTaskIds = Array.from(finish.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinish = {
      ...finish,
      taskIds: finishTaskIds,
    };

    setData({
      ...data,
      columns: {
        ...data.columns,
        [newStart.id]: newStart,
        [newFinish.id]: newFinish,
      },
    });
  };

  const addTask = (columnId: ColumnId) => {
    if (!newTaskContent.trim()) return;

    const taskId = `task-${Date.now()}`;
    const newTask: Task = {
      id: taskId,
      content: newTaskContent,
      createdAt: Date.now(),
    };

    const column = data.columns[columnId];
    const newTaskIds = [...column.taskIds, taskId];

    setData({
      ...data,
      tasks: {
        ...data.tasks,
        [taskId]: newTask,
      },
      columns: {
        ...data.columns,
        [columnId]: {
          ...column,
          taskIds: newTaskIds,
        },
      },
    });

    setNewTaskContent('');
    setIsAddingTo(null);
  };

  const deleteTask = (taskId: string, columnId: ColumnId) => {
    const newTasks = { ...data.tasks };
    delete newTasks[taskId];

    const column = data.columns[columnId];
    const newTaskIds = column.taskIds.filter(id => id !== taskId);

    setData({
      ...data,
      tasks: newTasks,
      columns: {
        ...data.columns,
        [columnId]: {
          ...column,
          taskIds: newTaskIds,
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="px-8 py-12 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <h1 className="text-5xl font-bold tracking-tight mb-2">Project Kanban</h1>
            <p className="text-neutral-500 font-medium">Organize your workflow with precision.</p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <button
              onClick={suggestTask}
              disabled={isSuggesting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSuggesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              AI Suggest Task
            </button>
            <div className="flex items-center gap-4 text-sm font-mono text-neutral-400 uppercase tracking-widest">
              <span>{Object.keys(data.tasks).length} Tasks</span>
              <span className="w-1 h-1 rounded-full bg-neutral-300" />
              <span>Local Storage Active</span>
            </div>
          </div>
        </motion.div>
      </header>

      {/* Board */}
      <main className="px-8 pb-20 max-w-7xl mx-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {data.columnOrder.map((columnId) => {
              const column = data.columns[columnId];
              const tasks = column.taskIds.map((taskId) => data.tasks[taskId]);

              return (
                <div key={column.id} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      {columnId === 'todo' && <Circle className="w-4 h-4 text-neutral-400" />}
                      {columnId === 'doing' && <Clock className="w-4 h-4 text-amber-500" />}
                      {columnId === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">
                        {column.title}
                      </h2>
                    </div>
                    <span className="text-xs font-mono font-bold bg-neutral-200 px-2 py-0.5 rounded-full text-neutral-600">
                      {tasks.length}
                    </span>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={cn(
                          "flex-1 min-h-[500px] rounded-2xl transition-colors duration-200 p-2",
                          snapshot.isDraggingOver ? "bg-neutral-100" : "bg-transparent"
                        )}
                      >
                        <div className="flex flex-col gap-3">
                          {tasks.map((task, index) => (
                            /* @ts-ignore */
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                 <div
                                   ref={provided.innerRef}
                                   {...provided.draggableProps}
                                   className={cn(
                                     "group bg-white rounded-xl border border-neutral-200 p-4 shadow-sm hover:shadow-md transition-all duration-200",
                                     snapshot.isDragging && "shadow-xl ring-2 ring-indigo-500/20 border-indigo-500/50"
                                   )}
                                 >
                                   <div className="flex items-start gap-3">
                                     <div {...provided.dragHandleProps} className="mt-1 text-neutral-300 group-hover:text-neutral-400 transition-colors">
                                       <GripVertical className="w-4 h-4" />
                                     </div>
                                     <div className="flex-1">
                                       <p className="text-sm font-semibold leading-tight mb-1">{task.content}</p>
                                       {task.description && (
                                         <p className="text-xs text-neutral-500 line-clamp-2">{task.description}</p>
                                       )}
                                     </div>
                                     <button
                                       onClick={() => deleteTask(task.id, column.id)}
                                       className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-500 transition-all"
                                     >
                                       <Trash2 className="w-4 h-4" />
                                     </button>
                                   </div>
                                 </div>
                               )}
                             </Draggable>
                          ))}
                        </div>
                        {provided.placeholder}

                        {/* Add Task Input */}
                        <div className="mt-4">
                          {isAddingTo === column.id ? (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white rounded-xl border border-indigo-500 p-3 shadow-lg"
                            >
                              <textarea
                                autoFocus
                                value={newTaskContent}
                                onChange={(e) => setNewTaskContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    addTask(column.id);
                                  }
                                  if (e.key === 'Escape') {
                                    setIsAddingTo(null);
                                    setNewTaskContent('');
                                  }
                                }}
                                placeholder="What needs to be done?"
                                className="w-full text-sm resize-none focus:outline-none min-h-[60px]"
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  onClick={() => {
                                    setIsAddingTo(null);
                                    setNewTaskContent('');
                                  }}
                                  className="text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-neutral-600 px-2 py-1"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => addTask(column.id)}
                                  className="text-xs font-bold uppercase tracking-wider bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                  Add Task
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            <button
                              onClick={() => setIsAddingTo(column.id)}
                              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neutral-300 text-neutral-400 hover:border-neutral-400 hover:text-neutral-500 hover:bg-neutral-50 transition-all text-sm font-medium"
                            >
                              <Plus className="w-4 h-4" />
                              Add Task
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </main>

      {/* Footer / Architecture Notes */}
      <footer className="border-t border-neutral-200 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Architecture Notes</h3>
              <ul className="space-y-3 text-sm text-neutral-600">
                <li className="flex gap-3">
                  <span className="text-indigo-500 font-mono font-bold">01</span>
                  <span><strong>State Management:</strong> Uses React's `useState` with a normalized data structure (tasks indexed by ID) for O(1) lookups and efficient updates.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-indigo-500 font-mono font-bold">02</span>
                  <span><strong>Persistence:</strong> Implements `localStorage` synchronization via `useEffect` to ensure your tasks persist across sessions.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-indigo-500 font-mono font-bold">03</span>
                  <span><strong>Drag & Drop:</strong> Powered by `@hello-pangea/dnd`, providing a robust and accessible drag-and-drop experience.</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Local Hosting</h3>
              <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                This application is running in a containerized environment. To host it on your own machine, you can clone the repository and run:
              </p>
              <code className="block bg-neutral-100 p-4 rounded-lg text-xs font-mono text-indigo-600">
                npm install<br />
                npm run dev
              </code>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
