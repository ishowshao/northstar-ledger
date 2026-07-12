import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { customersApi, projectsApi } from "../lib/api.js";

export function ProjectList() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  if (isLoading) return <div>加载中...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>项目</h2>
        <Link to="/projects/new" className="btn btn-primary">
          新建项目
        </Link>
      </div>
      {projects && projects.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  {p.status === "active"
                    ? "进行中"
                    : p.status === "completed"
                      ? "已完成"
                      : "已取消"}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (confirm("确定删除此项目？")) deleteMutation.mutate(p.id);
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">暂无项目</p>
      )}
    </div>
  );
}

export function ProjectForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.list,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { name: "", status: "active", customerId: "" },
  });

  const mutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/projects");
    },
  });

  return (
    <div>
      <h2>新建项目</h2>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="form">
        <div className="form-field">
          <label>项目名称 *</label>
          <input {...register("name", { required: "请输入项目名称" })} />
          {errors.name && <span className="error">{errors.name.message}</span>}
        </div>
        <div className="form-field">
          <label>状态</label>
          <select {...register("status")}>
            <option value="active">进行中</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div className="form-field">
          <label>关联客户</label>
          <select {...register("customerId")}>
            <option value="">无</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "创建中..." : "创建项目"}
          </button>
          <button type="button" className="btn" onClick={() => navigate("/projects")}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
