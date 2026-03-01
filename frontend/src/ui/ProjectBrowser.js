/**
 * ProjectBrowser - Modal for browsing, creating, and opening shared projects
 *
 * Shows a list of projects the user has access to from the cloud API.
 * Provides create, open, delete, import, and export actions.
 */
import { apiGet, apiPost, apiDelete } from '../auth/api-client.js';
import { getUser } from '../auth/auth.js';

export class ProjectBrowser {
  constructor(fileManager) {
    this.fileManager = fileManager;
    this.overlay = null;
    this.projects = [];
  }

  /**
   * Show the project browser modal
   */
  async show() {
    if (this.overlay) return;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff; border-radius: 8px; width: 600px; max-height: 80vh;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3); display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px; border-bottom: 1px solid #eee;
      display: flex; justify-content: space-between; align-items: center;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Projects';
    title.style.cssText = 'margin: 0; font-size: 18px; color: #333;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 24px; cursor: pointer;
      color: #666; padding: 0; line-height: 1;
    `;
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Actions bar
    const actions = document.createElement('div');
    actions.style.cssText = `
      padding: 12px 20px; border-bottom: 1px solid #eee;
      display: flex; gap: 8px;
    `;

    const btnStyle = `
      padding: 6px 14px; border-radius: 4px; cursor: pointer;
      font-size: 13px; font-family: inherit; border: 1px solid #ccc;
    `;

    const newBtn = document.createElement('button');
    newBtn.textContent = 'New Project';
    newBtn.style.cssText = btnStyle + 'background: #4a90d9; color: #fff; border-color: #3670a9;';
    newBtn.addEventListener('click', () => this.createProject());

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import File';
    importBtn.style.cssText = btnStyle + 'background: #f5f5f5; color: #333;';
    importBtn.addEventListener('click', () => {
      this.close();
      this.fileManager.importLocal();
    });

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export File';
    exportBtn.style.cssText = btnStyle + 'background: #f5f5f5; color: #333;';
    exportBtn.addEventListener('click', () => {
      this.close();
      this.fileManager.exportLocal();
    });

    actions.appendChild(newBtn);
    actions.appendChild(importBtn);
    actions.appendChild(exportBtn);

    // Project list
    this.listContainer = document.createElement('div');
    this.listContainer.style.cssText = `
      flex: 1; overflow-y: auto; padding: 8px 20px;
      min-height: 200px; max-height: 400px;
    `;

    modal.appendChild(header);
    modal.appendChild(actions);
    modal.appendChild(this.listContainer);
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Close on Escape
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    // Load projects
    await this.loadProjects();
  }

  /**
   * Load and render the project list
   */
  async loadProjects() {
    this.listContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#888;">Loading...</div>';

    try {
      this.projects = await apiGet('/projects');
      this.renderList();
    } catch (err) {
      this.listContainer.innerHTML = `
        <div style="text-align:center; padding:40px; color:#c00;">
          Failed to load projects: ${err.message}
        </div>
      `;
    }
  }

  /**
   * Render the project list
   */
  renderList() {
    this.listContainer.innerHTML = '';

    if (this.projects.length === 0) {
      this.listContainer.innerHTML = `
        <div style="text-align:center; padding:40px; color:#888;">
          No projects yet. Create one or import a local file.
        </div>
      `;
      return;
    }

    const user = getUser();
    const userEmail = user ? user.email.toLowerCase() : '';

    for (const project of this.projects) {
      const row = document.createElement('div');
      row.style.cssText = `
        padding: 12px; margin-bottom: 6px; border: 1px solid #e0e0e0;
        border-radius: 6px; cursor: pointer; transition: all 0.15s;
        display: flex; justify-content: space-between; align-items: center;
      `;
      row.addEventListener('mouseenter', () => { row.style.background = '#f8f9fa'; row.style.borderColor = '#c0c0c0'; });
      row.addEventListener('mouseleave', () => { row.style.background = '#fff'; row.style.borderColor = '#e0e0e0'; });

      // Info section
      const info = document.createElement('div');
      info.style.cssText = 'flex: 1; min-width: 0;';

      const name = document.createElement('div');
      name.textContent = project.name;
      name.style.cssText = 'font-weight: 600; font-size: 14px; color: #333; margin-bottom: 2px;';

      const meta = document.createElement('div');
      const address = project.propertyAddress ? ` \u2014 ${project.propertyAddress}` : '';
      const date = project.lastModified ? new Date(project.lastModified).toLocaleDateString() : '';
      const isOwner = project.owner?.toLowerCase() === userEmail;
      const ownerLabel = isOwner ? 'You' : (project.owner || 'Unknown');
      meta.textContent = `${project.elementCount} elements \u00b7 ${date} \u00b7 Owner: ${ownerLabel}${address}`;
      meta.style.cssText = 'font-size: 11px; color: #888;';

      info.appendChild(name);
      info.appendChild(meta);

      // Actions
      const actionsDiv = document.createElement('div');
      actionsDiv.style.cssText = 'display: flex; gap: 4px; margin-left: 8px;';

      const openBtn = document.createElement('button');
      openBtn.textContent = 'Open';
      openBtn.style.cssText = `
        padding: 4px 12px; background: #4a90d9; color: #fff;
        border: none; border-radius: 3px; cursor: pointer;
        font-size: 12px; font-family: inherit;
      `;
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openProject(project.id);
      });

      actionsDiv.appendChild(openBtn);

      // Delete button (only for owner)
      if (isOwner) {
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Del';
        delBtn.style.cssText = `
          padding: 4px 8px; background: #fff; color: #c00;
          border: 1px solid #ddd; border-radius: 3px; cursor: pointer;
          font-size: 12px; font-family: inherit;
        `;
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteProject(project.id, project.name);
        });
        actionsDiv.appendChild(delBtn);
      }

      row.appendChild(info);
      row.appendChild(actionsDiv);

      // Click row to open
      row.addEventListener('click', () => this.openProject(project.id));

      this.listContainer.appendChild(row);
    }
  }

  /**
   * Create a new project
   */
  async createProject() {
    const name = prompt('Project name:');
    if (!name) return;

    try {
      const result = await apiPost('/projects', {
        name,
        layout: JSON.parse(this.fileManager.serialize())
      });

      this.fileManager.currentProjectId = result.id;
      this.fileManager.currentProjectName = name;
      this.close();
    } catch (err) {
      alert('Failed to create project: ' + err.message);
    }
  }

  /**
   * Open a project from the cloud
   */
  async openProject(id) {
    try {
      const data = await apiGet(`/projects/${id}`);
      this.fileManager.currentProjectId = data.id;
      this.fileManager.currentProjectName = data.name;
      this.fileManager.currentProjectCanEdit = data.canEdit;

      // Deserialize the layout portion
      if (data.layout) {
        this.fileManager.deserialize(JSON.stringify(data.layout));
      }

      this.close();
    } catch (err) {
      alert('Failed to open project: ' + err.message);
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
      await apiDelete(`/projects/${id}`);

      // Clear current project if it was the deleted one
      if (this.fileManager.currentProjectId === id) {
        this.fileManager.currentProjectId = null;
        this.fileManager.currentProjectName = null;
      }

      await this.loadProjects();
    } catch (err) {
      alert('Failed to delete project: ' + err.message);
    }
  }

  /**
   * Close the modal
   */
  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  }
}
