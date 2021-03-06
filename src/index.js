'use strict';

// Module dependencies ========
const fs = require('fs');
const path = require('path');

// Module =====================

module.exports = (mode, name) => {
    const components = findFiles(mode, name);
    const builtComponents = buildComponents(components);
    return flattenComponents(builtComponents);
};

// Internal functions =========

function findFiles(mode, name) {
    const dirname = (module.parent !== 'undefined')
        ? path.dirname(module.parent.filename)
        : __dirname;
    const basepath = (process.env.NODE_PATH !== 'undefined') ? dirname : process.env.NODE_PATH;
    if (typeof name === 'undefined') name = mode;
    let searchpath = `${basepath}/${mode}`;

    if (name.split('.').length > 1) searchpath = path.dirname(searchpath);

    let files = getDirectory(searchpath);
    if (mode === 'filter') files = filterFiles(files, path.basename(name, path.extname(name)));

    return { files, mode };
}

function filterFiles(components, name) {
    Object.keys(components).forEach(componentName => {
        const component = components[componentName];
        Object.keys(component).forEach(fileName => {
            if (fileName.indexOf(name) === -1) {
                delete components[componentName][fileName];
            }
        });
    });
    return components;
}

function reduceFiles(components) {
    Object.keys(components).forEach(ComponentKey => {
        const component = components[ComponentKey];
        const componentKeys = Object.keys(component);
        if (componentKeys.length > 0) {
            const splitName = ComponentKey.split('.');
            components[splitName[0]] = components[ComponentKey][splitName[0]];
        }
    });
    return components;
}

function buildComponents(objects) {
    if (typeof objects === 'undefined') return objects;
    const components = objects.files;
    const mode = objects.mode;
    const readyComponents = {};

    Object.keys(components).forEach(componentName => {
        const component = {paths: {}};
        const modules = components[componentName];
        Object.keys(modules).forEach(moduleName => {
            if (moduleName === 'index') {
                component.paths.component = modules[moduleName];
                component.component = () => require(modules[moduleName]);
            }

            if (mode === 'filter') {
                if (typeof readyComponents[moduleName] === 'undefined') {
                    readyComponents[moduleName] = {};
                    readyComponents.paths = {};
                }

                readyComponents[moduleName][componentName] = () => require(modules[moduleName]);
                readyComponents.paths[componentName] = modules[moduleName];
            } else {
                component.paths[moduleName] = modules[moduleName];
                component[moduleName] = () => require(modules[moduleName]);
            }
        });

        if (mode !== 'filter') readyComponents[componentName] = component;
    });

    return readyComponents;
}

function flattenComponents(components) {
    const componentNames = Object.keys(components);
    componentNames.forEach((name, index) => {
        if (name === 'paths' || name === 'component' || name === 'index') {
            componentNames.splice(index, 1);
        }
    });

    if (componentNames.length === 1) {
        const flattenedComponents = {};
        Object.keys(components[componentNames[0]]).forEach(componentName => {
            flattenedComponents[componentName] = components[componentNames[0]][componentName];
        });
        flattenedComponents.paths = components.paths;
        return flattenedComponents;
    }

    components = reduceFiles(components);

    return components;
}

// Load based on component
function getDirectory(srcpath) {
    const files = walk(srcpath);
    const modules = {};
    files.forEach(fullPath => {
        const componentName = path.basename(path.dirname(fullPath));
        const filename = path.basename(fullPath, path.extname(fullPath));
        if (typeof modules[componentName] === 'undefined') {
            modules[componentName] = {};
        }
        modules[componentName][filename] = fullPath;
    });
    return modules;
}

function walk(dir) {
    if (path.basename(dir) === 'node_modules'
       || path.basename(dir) === '.git') return null;
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = `${dir}/${file}`;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) results = results.concat(walk(file));
        else results.push(file);
    });
    return results;
}
