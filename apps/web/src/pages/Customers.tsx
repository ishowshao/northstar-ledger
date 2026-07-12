import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { customersApi } from "../lib/api.js";

export function CustomerList() {
  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.list,
  });
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: customersApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });

  if (isLoading) return <div>加载中...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>客户</h2>
        <Link to="/customers/new" className="btn btn-primary">
          新建客户
        </Link>
      </div>
      {customers && customers.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>邮箱</th>
              <th>电话</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email ?? "-"}</td>
                <td>{c.phone ?? "-"}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (confirm("确定删除此客户？")) deleteMutation.mutate(c.id);
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
        <p className="empty-state">暂无客户</p>
      )}
    </div>
  );
}

export function CustomerForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { name: "", email: "", phone: "", notes: "" },
  });

  const mutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate("/customers");
    },
  });

  return (
    <div>
      <h2>新建客户</h2>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="form">
        <div className="form-field">
          <label>客户名称 *</label>
          <input {...register("name", { required: "请输入客户名称" })} />
          {errors.name && <span className="error">{errors.name.message}</span>}
        </div>
        <div className="form-field">
          <label>邮箱</label>
          <input type="email" {...register("email")} />
        </div>
        <div className="form-field">
          <label>电话</label>
          <input {...register("phone")} />
        </div>
        <div className="form-field">
          <label>备注</label>
          <textarea {...register("notes")} rows={3} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "创建中..." : "创建客户"}
          </button>
          <button type="button" className="btn" onClick={() => navigate("/customers")}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
