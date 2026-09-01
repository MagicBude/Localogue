# Repository 模式

## 目的

V1 用 JSON，V2 用 SQLite。页面不应该知道数据究竟存在文件还是数据库里。

## 概念接口

```ts
interface LibraryRepository {
  findWorkById(id: string): Promise<Work | null>;
  findWorkByCode(code: string): Promise<Work | null>;
  listWorks(query: WorkQuery): Promise<WorkSearchResult>;

  findPersonById(id: string): Promise<Person | null>;
  listPeople(query: PersonQuery): Promise<PersonSearchResult>;

  saveWork(work: Work): Promise<void>;
  savePerson(person: Person): Promise<void>;
}
```

V1：`JsonLibraryRepository`。

V2：`SqliteLibraryRepository`。

## 禁止事项

- React 页面直接 `readFileSync()`；
- 每个页面各自扫描 JSON；
- 把 JSON 文件布局暴露为业务 API；
- 为了 V1 方便而破坏未来关系模型。
