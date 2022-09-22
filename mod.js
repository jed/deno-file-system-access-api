import {basename, join} from 'https://deno.land/std@0.157.0/path/mod.ts'

let constructorKey = Symbol()

class StorageManager {
  async getDirectory() {
    return new FileSystemDirectoryHandle(constructorKey, Deno.cwd())
  }
}

class FileSystemHandle {
  #path

  constructor(key, path) {
    if (key !== constructorKey) {
      throw new TypeError('Illegal invocation')
    }

    this.#path = path
  }

  isSameEntry(entry) {
    return this.#path === entry.#path
  }

  async queryPermission() {
    let desc = {name: 'read', path: this.#path}
    let {state} = await Deno.permissions.query(desc)
    return state
  }

  async requestPermission() {
    throw ''
  }
}

class FileSystemFileHandle extends FileSystemHandle {
  #path

  constructor(key, path) {
    super(key, path)

    this.#path = path

    Object.defineProperty(this, 'kind', {
      value: 'file',
      writable: false,
      enumerable: true
    })

    Object.defineProperty(this, 'name', {
      value: basename(this.#path),
      writable: false,
      enumerable: true
    })
  }

  async getFile() {
    let [bytes, lstat] = await Promise.all([
      Deno.readFile(this.#path),
      Deno.lstat(this.#path),
    ])

    return new File([bytes], this.name, {
      lastModified: lstat.mtime.valueOf()
    })
  }

  async createWritable() {
    // TODO: implement proper FileSystemWritableFileStream
    let opts = {create: true, write: true, truncate: true}
    let file = await Deno.open(this.#path, opts)
    return file.writable
  }

  async move() {
    throw new Error('Not implemented')
  }
}

class FileSystemDirectoryHandle extends FileSystemHandle {
  #path

  constructor(key, path) {
    super(key, path)

    this.#path = path

    Object.defineProperty(this, 'kind', {
      value: 'directory',
      writable: false,
      enumerable: true
    })

    Object.defineProperty(this, 'name', {
      value: basename(this.#path),
      writable: false,
      enumerable: true
    })
  }

  async *entries() {
    let entries = Deno.readDir(this.#path)
    for await (let {name, isFile, isDirectory} of entries) {
      if (isDirectory) yield [name, await this.getDirectoryHandle(name)]
      else if (isFile) yield [name, await this.getFileHandle(name)]
    }
  }

  async getFileHandle(name) {
    let path = join(this.#path, name)
    return new FileSystemFileHandle(constructorKey, path)
  }

  async getDirectoryHandle(name) {
    let path = join(this.#path, name)
    return new FileSystemDirectoryHandle(constructorKey, path)
  }

  async *keys() {
    for await (let entry of this.entries()) yield entry[0]
  }

  async removeEntry(name, {recursive = false} = {}) {
    throw new Error('Not implemented')
  }

  async resolve(possibleDescendant) {
    throw new Error('Not implemented')
  }

  async *values() {
    for await (let entry of this.entries()) yield entry[1]
  }

  [Symbol.asyncIterator]() {
    return this.entries()
  }
}

self.StorageManager = StorageManager
self.FileSystemHandle = FileSystemHandle
self.FileSystemFileHandle = FileSystemFileHandle
self.FileSystemDirectoryHandle = FileSystemDirectoryHandle
self.navigator.storage = new StorageManager()
